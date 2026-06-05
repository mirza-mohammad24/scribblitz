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
import { endRound, endGame } from './fsm/roundManager';
import { roomManager } from './rooms/RoomManager';
import { getSocketUserId } from './socket/utils/getSocketUserId';
import { serializeRoom } from './socket/utils/serializeRoom';
import { handleChatMessage } from './socket/handlers/messageHandlers';
interface SocketData {
  userId: string;
  roomCode?: string;
}

const app = express();
const httpServer = createServer(app);

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
- Reconnect: A user who was previously connected to a room but got disconnected (e.g., due to network issues) and is now trying to rejoin. In this case, we want to restore their previous state in the room, including their player information and any ongoing game state. The server will check if the user ID matches a player in any existing room (the for loop) and reattach them to that room if found and no lobby handlers are called.

- Fresh Join: A user who is connecting to the server for the first time or is not currently associated with any existing room and hence the for loop is skipped. In this case, they will go through the normal lobby flow where they can create a new room or join an existing one by providing a room code. The corresponding lobby handlers (handleCreateRoom and handleJoinRoom) will be called based on the client's emitted event.
*/
io.on('connection', (socket: Socket) => {
  const userId = getSocketUserId(socket);
  if (!userId) return;

  console.log(`[Socket] User Connected: ${userId}`);

  // Connection count logging
  console.log(`[Socket] Connected: ${userId} | Total online: ${io.sockets.sockets.size}`);

  //RECONNECT LOGIC: Check if user is returning within 60 seconds grace period
  for (const room of roomManager.getAllRooms()) {
    const state = room.getState();
    const player = state.players.get(userId);

    if (player && !player.isConnected) {
      player.isConnected = true;
      socket.join(state.roomCode);
      socket.data.roomCode = state.roomCode; //reattach room code to socket session for future reference

      // Send the exact same payload as a fresh join
      const serializedRoom = serializeRoom(state);
      socket.emit(ServerEvents.ROOM_JOINED, {
        room: serializedRoom,
      });

      console.log(`[Socket] User Reconnected: ${userId} to Room: ${state.roomCode}`);

      //tell the other players in the room that this player has rejoined
      socket.to(state.roomCode).emit(ServerEvents.PLAYER_JOINED, { player });
      break; //stop searching after first match (a player should only be in one room at a time)
    }
  }

  //Route incoming events to Zod validated handlers
  socket.on(ClientEvents.ROOM_CREATE, handleCreateRoom(io, socket));
  socket.on(ClientEvents.ROOM_JOIN, handleJoinRoom(io, socket));
  socket.on(ClientEvents.GAME_START, handleGameStart(io, socket));
  socket.on(ClientEvents.WORD_SELECT, handleWordSelect(io, socket));
  socket.on(ClientEvents.CHAT_MESSAGE, handleChatMessage(io, socket));

  // ---------------------------------------------------------
  // DISCONNECT & GRACE PERIOD LOGIC
  // ---------------------------------------------------------
  socket.on('disconnect', () => {
    console.log(
      `[Socket] Disconnected: ${userId} | Remaining: ${Math.max(0, io.sockets.sockets.size - 1)}`,
    );

    const roomCode = socket.data.roomCode; //added in handler while adding player to room
    if (!roomCode) return;

    const room = roomManager.getRoom(roomCode);
    if (!room) return;

    const state = room.getState();
    const player = state.players.get(userId);

    if (player) {
      player.isConnected = false; //Mark as offline, but keep in memory for potential reconnection within grace period
    }

    io.to(roomCode).emit(ServerEvents.PLAYER_LEFT, { playerId: userId });

    // --- DRAWER DISCONNECT & MIN PLAYER LOGIC ---
    const activePlayers = Array.from(state.players.values()).filter((p) => p.isConnected);
    const isGameActive =
      state.gameState === GameState.DRAWING || state.gameState === GameState.ROUND_STARTING;

    if (activePlayers.length < GAME_CONSTANTS.MIN_PLAYERS && isGameActive) {
      //Too few players to continue playing
      endGame(io, roomCode);
    } else if (state.currentDrawerId === userId && isGameActive) {
      //Drawer disconnected, but enough players remain to continue to next round -
      // end current round immediately to trigger drawer rotation
      endRound(io, roomCode, 'drawer-disconnected');
    }

    //60 second cleanup timeout
    setTimeout(() => {
      const roomCheck = roomManager.getRoom(roomCode);
      if (!roomCheck) return;

      const p = roomCheck.getState().players.get(userId);

      // If player is still marked as disconnected after grace period, remove them from the room
      if (p && !p.isConnected) {
        roomManager.removePlayer(roomCode, userId);

        io.to(roomCode).emit(ServerEvents.PLAYER_LEFT, {
          playerId: userId,
          //indicates to clients that this player has been removed from the room
          // and cannot rejoin without joining again
          permanent: true,
        });
        console.log(
          `[Socket] Player ${userId} permanently purged from Room: ${roomCode} due to timeout`,
        );
      }
    }, 60_000);
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
