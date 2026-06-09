/**
 * This handler manages incoming canvas batch updates from clients. It performs three key functions:
 * 1. Validation: It uses a schema to validate the incoming data, ensuring that only well-formed
 *    batches are processed, which protects the server from crashes and exploits.
 * 2. Broadcasting: Valid batches are immediately broadcasted to all other players in the same room,
 *    ensuring real-time synchronization of the canvas with minimal latency.
 * 3. Persistence: Each batch is asynchronously saved to a Redis Stream, allowing for replaying the
 *    drawing history for late joiners or reconnections. The stream is capped to prevent memory leaks,
 *    and entries have a TTL to automatically clean up data from inactive rooms.
 */

import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents, GameState } from '@scribblitz/types';
import {
  CanvasBatchSchema,
  HistoryPayloadSchema,
  CanvasSyncRequestSchema,
} from '@scribblitz/validation';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { redis } from '../../lib/redis';
import { roomManager } from '../../rooms/RoomManager';

// In-memory rate limiting map (cleared on disconnect)
const syncRateLimitMap = new Map<string, number>();

/**
 * Registers the canvas event handlers for the given Socket.IO server and socket.
 * This function listens for canvas batch updates from clients, validates the data, broadcasts it to
 * other players, and saves it to Redis for persistence.
 * @param io
 * @param socket
 */
export const registerCanvasHandlers = (io: Server, socket: Socket) => {
  // Cleanup rate limit on disconnect
  socket.on('disconnect', () => {
    syncRateLimitMap.delete(socket.id);
  });

  // Listen for canvas batch updates from clients and handle them accordingly
  socket.on(ClientEvents.CANVAS_BATCH, (payload) => {
    try {
      //1. Validate: Protect the server from malformed or malicious data that could cause crashes or exploits
      const result = CanvasBatchSchema.safeParse(payload);
      if (!result.success) {
        console.warn(`[Canvas] Invalid batch payload from ${socket.id}:`, result.error.errors);
        return;
      }

      const { strokes } = result.data; //safe data to work with
      if (strokes.length === 0) return; //Ignore empty batches

      // SECURITY: Use server-authoritative roomCode, not client sessionId
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;
      const state = room.getState();

      //Security fix: Verify that the sender is actually the drawer in the room before accepting their batch
      // and the drawing or parallel_drawing is going on. This prevents malicious clients from sending fake
      // batches to rooms they're not in or when they're not supposed to be drawing.
      if (
        state.currentDrawerId !== socket.data.userId ||
        (state.gameState !== GameState.DRAWING && state.gameState !== GameState.PARALLEL_DRAWING)
      ) {
        console.warn(`[Security] Blocked unauthorized drawing from ${socket.data.userId}`);
        return;
      }

      //2. Broadcast Immediately after verification: Send to all other players in the room
      //We do this before Redis to guarantee ultra-low latency for watches
      socket.to(roomCode as string).emit(ServerEvents.CANVAS_BATCH, { strokes });

      //3. Persistence: Save to Redis Stream asynchronously (Fire and Forget)
      const streamKey = `room:${roomCode}:canvas`;

      const pipeline = redis.pipeline();
      pipeline.xadd(
        streamKey,
        'MAXLEN',
        '~',
        5000, //Soft cap at ~5000 batches to prevent memory leaks
        '*', //Redis generates the timestamp ID
        'batch',
        JSON.stringify(strokes),
      );
      pipeline.expire(streamKey, 60 * 60 * 2); // 2 hour TTL: Auto-delete dead rooms

      pipeline.exec().catch((err) => {
        console.error('[Redis] Failed to append canvas batch: ', err);
      });
    } catch (error) {
      console.error('[Canvas] Handler fatal error: ', error);
    }
  });

  // ==========================================
  // THE TIME MACHINE: Canvas History Sync
  // ==========================================
  socket.on(ClientEvents.CANVAS_SYNC_REQUEST, async (payload: unknown) => {
    try {
      //Zod validation for the sync request payload
      const result = CanvasSyncRequestSchema.safeParse(payload);
      if (!result.success) {
        console.warn(`[Canvas] Invalid sync request from ${socket.id}:`, result.error.errors);
        return;
      }

      //Rate limiting
      const now = Date.now();
      const lastSync = syncRateLimitMap.get(socket.id) ?? 0;
      if (now - lastSync < GAME_CONSTANTS.SYNC_RATE_LIMIT_MS) {
        console.warn(`[Canvas] Sync request rate limit exceeded for ${socket.id}`);
        return;
      }
      syncRateLimitMap.set(socket.id, now);

      const { roomCode } = result.data; //safe data to work with

      //Room membership check: Ensure the requester is actually in the room they're asking to sync
      if (socket.data.roomCode !== roomCode) {
        console.warn(
          `[Security] Blocked unauthorized sync request from ${socket.id} for room ${roomCode}`,
        );
        return;
      }

      const streamKey = `room:${roomCode}:canvas`;

      //1. XRANGE fetched everything from the start ('-') to the end ('+') of the stream
      const rawStream = await redis.xrange(streamKey, '-', '+');

      if (!rawStream || rawStream.length === 0) {
        socket.emit(ServerEvents.CANVAS_HISTORY, { strokes: [] });
        return;
      }

      //2. Parse the stream entries to extract strokes
      // ioredis return: [ [ id, [ "batch", "[{...}]" ] ], ... ]\
      // flatMap automatically merges the array of batches into one giant continuous timeline of strokes
      const historyStrokes = rawStream.flatMap((entry) => {
        try {
          // entry[1] is the array of fields/values. Index 0 is 'batch', Index 1 is the JSON string.
          const jsonString = entry[1][1];
          if (!jsonString) return [];

          const parsed = JSON.parse(jsonString);

          //Re validate each batch against the schema to ensure data integrity, even if it
          //means dropping malformed entries
          const validatedBatchResult = HistoryPayloadSchema.safeParse(
            Array.isArray(parsed) ? parsed : [parsed],
          );

          if (!validatedBatchResult.success) {
            console.warn(
              `[Canvas] Invalid batch in history stream for room ${roomCode}:`,
              validatedBatchResult.error.errors,
            );
            return [];
          }

          return validatedBatchResult.data; //This is the array of strokes from this batch
        } catch (err) {
          console.error('[Redis] Failed to parse history batch: ', err);
          return []; //Skip malformed entries but keep going
        }
      });

      //3. Send the entire history back to the requester
      socket.emit(ServerEvents.CANVAS_HISTORY, { strokes: historyStrokes });
      //log it
      console.log(
        `[Canvas] Sent history of ${historyStrokes.length} strokes to ${socket.id} for room ${roomCode}`,
      );
    } catch (error) {
      console.error('[Canvas] History sync fatal error: ', error);
    }
  });
};
