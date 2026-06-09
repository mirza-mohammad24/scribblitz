/**
 * Main entry point for the Scribblitz game server.
 * Bootstraps the Express HTTP server and attaches the Socket.io instance.
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents, GameState } from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { handleCreateRoom, handleJoinRoom } from './socket/handlers/lobbyHandlers';
import { handleGameStart, handleWordSelect } from './socket/handlers/gameHandlers';
import { handleChatMessage } from './socket/handlers/messageHandlers';
import { registerCanvasHandlers } from './socket/handlers/canvasHandlers';
import { endRound, endGame } from './fsm/roundManager';
import { roomManager } from './rooms/RoomManager';
import { getUserIdBySocket } from './socket/utils/getUserIdBySocket';
import { serializeRoom } from './socket/utils/serializeRoom';
import { clearTimer, clearIntervalTimer } from './utils/timerCleanUp';
interface SocketData {
  userId: string;
  roomCode?: string;
}

const app = express();
const httpServer = createServer(app);

//Track disconnect timers for each user ID to allow cancellation of previous timer on reconnect
//or else only the previous timer will keep on running and will provide less time for reconnection
// on subsequent disconnects
//This map is used in both the reconnect and disconnect logic in the socket connection handler below
const disconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

//Socket.io initialized with Strict CORS for Next.js frontend
const io = new Server<any, any, any, SocketData>(httpServer, {
  cors: {
    origin: process.env.WEB_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// =========================
// Socket Middleware
// =========================

io.use((socket, next) => {
  const token = socket.handshake.auth.token;

  if (!token || typeof token !== 'string') {
    return next(new Error('No auth token provided'));
  }

  //UUID format validation (Standard 36-characters UUID with dashes)
  const isValidUUID =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);

  if (!isValidUUID) {
    return next(new Error('Invalid token format'));
  }

  // Store the validated UUID on the socket session
  socket.data.userId = token;
  next();
});

// =========================
// Connection & Routing
// =========================

/*
IMPORTANT DISTINCTION BETWEEN RECONNECT AND FRESH JOIN:
- Reconnect: A user who was previously connected to a room but got disconnected (e.g., due to network issues) 
  and is now trying to rejoin. In this case, we want to restore their previous state in the room, including 
  their player information and any ongoing game state. The server will check if the user ID matches a 
  player in any existing room (using the playerRoomIndex for O(1) lookup) and reattach them to that room if found 
  and no lobby handlers are called.

- Fresh Join: A user who is connecting to the server for the first time or is not currently associated with 
  any existing room and hence the for loop is skipped. In this case, they will go through the normal lobby 
  flow where they can create a new room or join an existing one by providing a room code. The corresponding 
  lobby handlers (handleCreateRoom and handleJoinRoom) will be called based on the client's emitted event.
*/
io.on('connection', (socket: Socket) => {
  const userId = getUserIdBySocket(socket);
  if (!userId) return;

  // Log new connections with user ID for better traceability in logs
  console.log(`[Socket] User Connected: ${userId}`);
  // Connection count logging
  console.log(`[Socket] Connected: ${userId} | Total online: ${io.sockets.sockets.size}`);

  //RECONNECT LOGIC: Check if user is returning within 60 seconds grace period
  const existingRoom = roomManager.getRoomByUserId(userId);

  if (existingRoom) {
    const state = existingRoom.getState();
    const player = state.players.get(userId);

    if (player && !player.isConnected) {
      player.isConnected = true;

      //Clear the disconnect timeout since the player has reconnected
      if (disconnectTimers.has(userId)) {
        clearTimer(disconnectTimers.get(userId) || null);
        disconnectTimers.delete(userId);
      }

      socket.join(state.roomCode);
      socket.data.roomCode = state.roomCode; //reattach room code to socket session for future reference

      // Send the exact same payload as a fresh join
      const serializedRoom = serializeRoom(state);
      socket.emit(ServerEvents.ROOM_JOINED, {
        room: serializedRoom,
      });

      // Log reconnection event with user ID and room code for better traceability in logs
      console.log(`[Socket] User Reconnected: ${userId} to Room: ${state.roomCode}`);

      //tell the other players in the room that this player has rejoined
      socket.to(state.roomCode).emit(ServerEvents.PLAYER_JOINED, { player });
    }
  }

  //Route incoming events to Zod validated handlers
  socket.on(ClientEvents.ROOM_CREATE, handleCreateRoom(io, socket));
  socket.on(ClientEvents.ROOM_JOIN, handleJoinRoom(io, socket));
  socket.on(ClientEvents.GAME_START, handleGameStart(io, socket));
  socket.on(ClientEvents.WORD_SELECT, handleWordSelect(io, socket));
  socket.on(ClientEvents.CHAT_MESSAGE, handleChatMessage(io, socket));

  //Register the canvas batched stroke events
  registerCanvasHandlers(io, socket);

  // ---------------------------------------------------------
  // DISCONNECT & GRACE PERIOD LOGIC
  // ---------------------------------------------------------
  socket.on('disconnect', () => {
    // Log disconnections with user ID and remaining connection count for better traceability in logs
    console.log(
      `[Socket] Disconnected: ${userId} | Remaining: ${Math.max(0, io.sockets.sockets.size - 1)}`,
    );

    //Use O(1) lookup to find the room code associated with this user ID safely
    const activeRoom = roomManager.getRoomByUserId(userId);
    if (!activeRoom) return; //User was not in any room or already cleaned up after grace period, so we skip the rest of the disconnect logic

    const state = activeRoom.getState();
    const roomCode = state.roomCode; //We can safely get the room code from the active room's state
    const player = state.players.get(userId);

    if (player) {
      player.isConnected = false; //Mark as offline, but keep in memory for potential reconnection within grace period
    }

    // Notify other players in the room that this player has disconnected (but not yet removed from room)
    io.to(roomCode).emit(ServerEvents.PLAYER_DISCONNECTED, {
      playerId: userId,
      gracePeriodSeconds: 60, //Inform clients about the grace period duration for better UX on their end
    });

    // --- DRAWER DISCONNECT & MIN PLAYER LOGIC ---

    const isGameActive =
      state.gameState === GameState.DRAWING ||
      state.gameState === GameState.PARALLEL_DRAWING ||
      state.gameState === GameState.ROUND_STARTING ||
      state.gameState === GameState.ROUND_END;

    // We DO NOT immediately endGame here to allow the 60-second grace period for watchers.
    // However, if the DRAWER disconnects, we immediately skip their turn so the game doesn't freeze.
    // We do this regardless of player count. If the player count is now < 2 (less than MIN PLAYERS),
    // the startNextRound() function will gracefully catch it and trigger endGame().
    if (state.currentDrawerId === userId && isGameActive) {
      endRound(io, roomCode, 'drawer-disconnected');
    }

    //Clear any existing timer just in case (this handles the case where a user disconnects, reconnects,
    // and disconnects again within the grace period)
    if (disconnectTimers.has(userId)) {
      clearTimer(disconnectTimers.get(userId) || null);
    }

    //60 second cleanup timeout
    const timer = setTimeout(() => {
      const roomCheck = roomManager.getRoom(roomCode);
      if (!roomCheck) return;

      const p = roomCheck.getState().players.get(userId);

      // If player is still marked as disconnected after grace period, remove them from the room
      if (p && !p.isConnected) {
        roomManager.removePlayer(roomCode, userId);

        // Notify other players in the room that this player has been permanently removed after grace period
        io.to(roomCode).emit(ServerEvents.PLAYER_LEFT, {
          playerId: userId,
          //indicates to clients that this player has been removed from the room
          //and cannot rejoin without joining again
          permanent: true,
        });
        // Log permanent removal after grace period with user ID and room code for better traceability in logs
        console.log(
          `[Socket] Player ${userId} permanently purged from Room: ${roomCode} due to timeout`,
        );

        const remainingPlayers = Array.from(roomCheck.getState().players.values()).filter(
          (p) => p.isConnected,
        );
        const stillActive =
          roomCheck.getState().gameState === GameState.DRAWING ||
          roomCheck.getState().gameState === GameState.PARALLEL_DRAWING ||
          roomCheck.getState().gameState === GameState.ROUND_STARTING ||
          roomCheck.getState().gameState === GameState.ROUND_END;

        if (remainingPlayers.length < GAME_CONSTANTS.MIN_PLAYERS && stillActive) {
          //Too few players to continue playing - end the game immediately (server emit is handled in endGame function)
          console.log(
            `[Socket] Ending game in Room: ${roomCode} due to insufficient players after timeout`,
          );
          endGame(io, roomCode);
        }
      }

      disconnectTimers.delete(userId); //Clean up the timer reference from the map after execution
    }, 60_000);

    // Store the disconnect timer so it can be cleared if the user reconnects within the grace period
    disconnectTimers.set(userId, timer);
  });
});

// =========================
// REST Endpoints
// =========================

// A simple health check for Docker and CI/CD pipelines
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// =========================
// Server Boot
// =========================

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Scribblitz Game Server running on port ${PORT}`);
});
