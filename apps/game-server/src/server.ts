/**
 * Main entry point for the Scribblitz game server.
 * Bootstraps the Express HTTP server and attaches the Socket.io instance.
 */

import express from 'express';
import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import { ClientEvents } from '@scribblitz/types';
import { handleCreateRoom, handleJoinRoom } from './socket/handlers/lobbyHandlers';
import { roomManager } from './rooms/RoomManager';
import { getSocketUserId } from './socket/utils/getSocketUserId';

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

io.on('connection', (socket: Socket) => {
  const userId = getSocketUserId(socket);
  console.log(`[Socket] User Connected: ${userId}`);

  // Connection count logging
  console.log(`[Socket] Connected: ${userId} | Total online: ${io.sockets.sockets.size}`);

  //Route incoming events to Zod validated handlers
  socket.on(ClientEvents.ROOM_CREATE, handleCreateRoom(io, socket));
  socket.on(ClientEvents.ROOM_JOIN, handleJoinRoom(io, socket));

  //Handle sudden disconnections
  socket.on('disconnecting', () => {
    console.log(`[Socket] Disconnected: ${userId} | Remaining: ${io.sockets.sockets.size - 1}`);

    const roomCode = socket.data.roomCode; //added in handler while adding player to room
    if (roomCode && userId) {
      //Till phase 1 we are removing them.
      //In later phases we will add a grace period to allow for reconnect
      roomManager.removePlayer(roomCode, userId);
    }
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
