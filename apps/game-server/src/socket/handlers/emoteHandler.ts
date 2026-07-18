/**
 * This module handles incoming emote events from clients. It validates the emote
 * payload, applies simple in-memory rate limiting per user to prevent spam,
 * and broadcasts an `EMOTE_BROADCAST` event to the room with a generated
 * animation start position and a unique client-side render id. Rate limiting is
 * intentionally lightweight and stored in-memory (cleared when players disconnect),
 * as emotes are a best-effort UI feature and do not require persistent tracking.
 */

import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents } from '@scribblitz/types';
import { emoteSchema } from '@scribblitz/validation';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { roomManager } from '../../rooms/RoomManager';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import logger from '../../utils/logger';

// In-memory rate limiting map (cleared naturally as players disconnect/reconnect(see register function below).
// Stores: Map<userId, [timestamp1, timestamp2, ...]>
const emoteRateLimitMap = new Map<string, number[]>();

/**
 * Handles an emote sent by a client. Validates the payload then applies a per-user
 * rate limit window to prevent spam. If allowed, broadcasts `ServerEvents.EMOTE_BROADCAST`
 * to the room with the emoji, sender id, a randomized startX for client animation,
 * and a unique id suitable for React rendering keys.
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
 * @returns A function that accepts the raw payload from the client and processes the emote.
 */
const handleEmote = (io: Server, socket: Socket) => (payload: unknown) => {
  //verify
  const result = emoteSchema.safeParse(payload);

  if (!result.success) {
    logger.warn({ socketId: socket.id, errors: result.error.errors }, 'Invalid emote payload');
    return; //return after logging
  }

  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  //RATE LIMITING
  const now = Date.now();
  const userTimeStamps = emoteRateLimitMap.get(userId) || [];

  //Filter out timestamps older than our time window
  const recentTimestamps = userTimeStamps.filter(
    (t) => now - t < GAME_CONSTANTS.EMOTE_RATE_LIMIT_WINDOW_MS,
  );

  //check for limit
  if (recentTimestamps.length >= GAME_CONSTANTS.EMOTE_RATE_LIMIT_MAX) {
    //Silently drop the emote to prevent the spam
    return;
  }

  recentTimestamps.push(now); //add the current timestamp when the user sent an emote to array
  emoteRateLimitMap.set(userId, recentTimestamps); //update the map

  //BROADCAST
  //Generate a random starting position for the floating animation (between 10% and 90% of screen width)
  const startX = Math.floor(Math.random() * 80) + 10;

  io.to(roomCode).emit(ServerEvents.EMOTE_BROADCAST, {
    emoji: result.data.emoji,
    senderId: userId,
    startX,
    id: `${userId}-${now}-${Math.random()}`, //Unique ID for react rendering mapping
  });
};

export const registerEmoteHandlers = (io: Server, socket: Socket) => {
  // Cleanup rate limit on disconnect
  socket.on('disconnect', () => {
    const userId = getUserIdBySocket(socket);
    if (userId) emoteRateLimitMap.delete(userId);
  });

  socket.on(ClientEvents.EMOTE_SEND, handleEmote(io, socket));
};
