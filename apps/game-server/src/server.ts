/**
 * Main entry point for the Scribblitz game server.
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents, GameState } from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import {
  handleCreateRoom,
  handleJoinRoom,
  handleLeaveRoom,
  handleUpdateConfig,
} from './socket/handlers/lobbyHandlers';
import {
  handleGameStart,
  handleWordSelect,
  handleReturnToLobby,
} from './socket/handlers/gameHandlers';
import { handleChatMessage } from './socket/handlers/messageHandlers';
import { registerCanvasHandlers } from './socket/handlers/canvasHandlers';
import { endRound, endGame } from './fsm/roundManager';
import { roomManager } from './rooms/RoomManager';
import { getUserIdBySocket } from './socket/utils/getUserIdBySocket';
import { serializeRoom } from './socket/utils/serializeRoom';
import { clearTimer, clearIntervalTimer } from './utils/timerCleanUp';
import { redis } from './lib/redis';
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
/**
 * This middleware runs on every incoming socket connection and validates the presence and
 * format of the authentication token. It ensures that only clients providing a valid UUID
 * token can establish a socket connection. The token is expected to be sent in the auth
 * payload during the handshake phase of the Socket.IO connection. If the token is valid,
 * it is stored in the socket's data for use in subsequent event handlers.
 * If the token is missing or invalid, the connection is rejected with an appropriate error message.
 * This middleware acts as a gatekeeper to ensure that only authenticated clients can interact with the game server.
 */
io.use((socket, next) => {
  const token = socket.handshake.auth.token; //We expect the client (useGameSocket.ts) to send the token in
  // the auth payload during the handshake

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
  // This userId will be used for all subsequent authentication and room management logic
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
  any existing room and hence the reconnection logic is skipped. In this case, they will go through the normal lobby 
  flow where they can create a new room or join an existing one by providing a room code. The corresponding 
  lobby handlers (handleCreateRoom and handleJoinRoom) will be called based on the client's emitted event.
*/
io.on('connection', (socket: Socket) => {
  const userId = getUserIdBySocket(socket);
  if (!userId) return;

  // Log new connections with user ID for better traceability in logs
  console.log(`[Socket] User Connected: ${userId} (from file server.ts)`);
  // Connection count logging
  console.log(
    `[Socket] Connected: ${userId} | Total online: ${io.sockets.sockets.size} (from file server.ts)`,
  );

  //RECONNECT LOGIC: Check if user is returning within 60 seconds grace period
  const existingRoom = roomManager.getRoomByUserId(userId);

  if (existingRoom) {
    const state = existingRoom.getState();
    const player = state.players.get(userId); //We can safely get the player from the room's state since
    // we have the room reference from the O(1) lookup

    if (player && !player.isConnected) {
      player.isConnected = true; //Mark the player as reconnected in the server state

      //Clear the disconnect timeout since the player has reconnected
      if (disconnectTimers.has(userId)) {
        clearTimer(disconnectTimers.get(userId) || null);
        disconnectTimers.delete(userId);
      }

      // Rejoin the socket room
      socket.join(state.roomCode);
      socket.data.roomCode = state.roomCode; //reattach room code to socket session for future reference

      // Send the exact same payload as a fresh join
      const serializedRoom = serializeRoom(state);
      // Emit the ROOM_JOINED event to the rejoining player with the current room state so
      // their client can sync up
      socket.emit(ServerEvents.ROOM_JOINED, {
        room: serializedRoom,
      });

      // Log reconnection event with user ID and room code for better traceability in logs
      console.log(
        `[Socket] User Reconnected: ${userId} to Room: ${state.roomCode} (from file server.ts)`,
      );

      //tell the other players (all sockets except the rejoining player) in the room
      // that this player has rejoined
      socket.to(state.roomCode).emit(ServerEvents.PLAYER_JOINED, { player });
    }
  }

  //Route incoming  client events to Zod validated handlers

  //Listener for fresh room creation and joining - these will trigger the lobby flow
  socket.on(ClientEvents.ROOM_CREATE, handleCreateRoom(io, socket));
  socket.on(ClientEvents.ROOM_JOIN, handleJoinRoom(io, socket));

  //Listener for room-related events like leaving, config updates, and game actions
  // these will trigger the game flow
  socket.on(ClientEvents.ROOM_LEAVE, handleLeaveRoom(io, socket));
  socket.on(ClientEvents.ROOM_UPDATE_CONFIG, handleUpdateConfig(io, socket));
  socket.on(ClientEvents.RETURN_TO_LOBBY, handleReturnToLobby(io, socket));
  socket.on(ClientEvents.GAME_START, handleGameStart(io, socket));
  socket.on(ClientEvents.WORD_SELECT, handleWordSelect(io, socket));
  socket.on(ClientEvents.CHAT_MESSAGE, handleChatMessage(io, socket));

  /**
   * Canvas event listener - this will trigger the drawing flow
   * We register the canvas handlers separately because they are more performance-sensitive
   * and have their own validation and security logic.
   * This separation allows us to optimize the canvas event handling without affecting the
   * other game logic handlers.
   */
  registerCanvasHandlers(io, socket);

  // ---------------------------------------------------------
  // DISCONNECT & GRACE PERIOD LOGIC
  // ---------------------------------------------------------
  socket.on('disconnect', () => {
    console.log(
      `[Socket] Disconnected: ${userId} | Remaining: ${Math.max(0, io.sockets.sockets.size - 1)} (from file server.ts)`,
    );

    //Use O(1) lookup to find the room code associated with this user ID safely
    const activeRoom = roomManager.getRoomByUserId(userId);
    //User was not in any room or already cleaned up after grace period, so we
    // skip the rest of the disconnect logic
    if (!activeRoom) return;

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
    // the startNextRound() (will be called inside endRound() which we called after appropriate checks)
    //  will gracefully catch it and trigger endGame().
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
        const removeResult = roomManager.removePlayer(roomCode, userId);

        // Notify other players in the room that this player has been permanently removed after grace period
        io.to(roomCode).emit(ServerEvents.PLAYER_LEFT, {
          playerId: userId,
          //indicates to clients that this player has been removed from the room
          //and cannot rejoin without joining again
          permanent: true,
        });

        // If the guy who permanently timed out was the host, broadcast the new host cleanly to everyone in the room
        if (removeResult && removeResult.wasHost && removeResult.newHostId) {
          io.to(roomCode).emit(ServerEvents.HOST_CHANGED, { newHostId: removeResult.newHostId });
        }

        // Log permanent removal after grace period with user ID and room code for better traceability in logs
        console.log(
          `[Socket] Player ${userId} permanently purged from Room: ${roomCode} due to timeout (from file server.ts)`,
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
            `[Socket] Ending game in Room: ${roomCode} due to insufficient players after timeout (from file server.ts)`,
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
redis
  .connect()
  .then(() => {
    console.log('[Redis] Connected successfully (from file server.ts)');
    httpServer.listen(PORT, () => {
      console.log(`Scribblitz Game Server running on port ${PORT} (from file server.ts)`);
    });
  })
  .catch((err) => {
    console.error('[Redis] Fatal connection error (from file server.ts):', err);
  });
