/**
 * Canvas Handlers for Scribblitz Game Server
 * This module defines the Socket.IO event handlers related to canvas interactions in the Scribblitz game server.
 * It includes handlers for receiving batches of strokes from clients, broadcasting them to other players,
 * and saving them to Redis for persistence. It also includes handlers for syncing canvas history for late joiners,
 * clearing the canvas, and undoing the last stroke. Each handler performs strict validation on incoming data,
 * checks user permissions, and includes security guards to prevent unauthorized actions and abuse.
 * The module is designed to ensure real-time performance while maintaining the integrity and security of
 * the game state.
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
 * This function listens for canvas batch updates from clients, validates the data,
 * broadcasts it to other players, and saves it to Redis for persistence.
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
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
        console.warn(
          `[Canvas] Invalid batch payload from ${socket.id} (from file canvasHandlers.ts):`,
          result.error.errors,
        );
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
        console.warn(`[Security] Blocked unauthorized drawing from ${socket.data.userId} in room ${roomCode} 
          (from file canvasHandlers.ts)`);
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
        console.error('[Redis] Failed to append canvas batch (from file canvasHandlers.ts): ', err);
      });
    } catch (error) {
      console.error('[Canvas] Handler fatal error (from file canvasHandlers.ts): ', error);
    }
  });

  // ==========================================
  // THE TIME MACHINE: Canvas History Sync
  // ==========================================
  // This handler allows clients to request the full history of canvas strokes for
  // the current room, which is essential for late joiners or players who got disconnected
  //  and need to sync up with the current state of the drawing. It includes strict validation,
  // rate limiting to prevent abuse, and security checks to ensure that only legitimate requests
  // from room members are processed.
  socket.on(ClientEvents.CANVAS_SYNC_REQUEST, async (payload: unknown) => {
    try {
      //Zod validation for the sync request payload
      const result = CanvasSyncRequestSchema.safeParse(payload);
      if (!result.success) {
        console.warn(
          `[Canvas] Invalid sync request from ${socket.id} (from file canvasHandlers.ts):`,
          result.error.errors,
        );
        return;
      }

      //Rate limiting
      const now = Date.now();
      const lastSync = syncRateLimitMap.get(socket.id) ?? 0;
      if (now - lastSync < GAME_CONSTANTS.SYNC_RATE_LIMIT_MS) {
        console.warn(
          `[Canvas] Sync request rate limit exceeded for ${socket.id} (from file canvasHandlers.ts)`,
        );
        return;
      }
      syncRateLimitMap.set(socket.id, now);

      const { roomCode } = result.data; //safe data to work with

      //Room membership check: Ensure the requester is actually in the room they're asking to sync
      if (socket.data.roomCode !== roomCode) {
        console.warn(
          `[Security] Blocked unauthorized sync request from ${socket.id} for room ${roomCode} (from file canvasHandlers.ts)`,
        );
        return;
      }

      const streamKey = `room:${roomCode}:canvas`;

      //1. XRANGE fetched everything from the start ('-') to the end ('+') of the stream
      const rawStream = await redis.xrange(streamKey, '-', '+');

      if (!rawStream || rawStream.length === 0) {
        socket.emit(ServerEvents.CANVAS_HISTORY, { strokes: [] }); //No history, send empty array
        console.warn(
          `[Canvas] No history found for room ${roomCode} during sync request (from file canvasHandlers.ts)`,
        );
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
              `[Canvas] Invalid batch in history stream for room ${roomCode} (from file canvasHandlers.ts): `,
              validatedBatchResult.error.errors,
            );
            return [];
          }

          return validatedBatchResult.data; //This is the array of strokes from this batch
        } catch (err) {
          console.error(
            '[Redis] Failed to parse history batch (from file canvasHandlers.ts): ',
            err,
          );
          return []; //Skip malformed entries but keep going
        }
      });

      //3. Send the entire history back to the requester
      socket.emit(ServerEvents.CANVAS_HISTORY, { strokes: historyStrokes });
      //log it
      console.log(
        `[Canvas] Sent history of ${historyStrokes.length} strokes to ${socket.id} for room ${roomCode} (from file canvasHandlers.ts)`,
      );
    } catch (error) {
      console.error('[Canvas] History sync fatal error (from file canvasHandlers.ts): ', error);
    }
  });

  //CLEAR CANVAS HANDLER
  // This handler listens for requests to clear the canvas, validates the sender's permissions, and if valid,
  // it deletes the Redis stream for the room and broadcasts a clear event to all clients. This allows the
  // current drawer to clear the canvas if they want to start fresh, while ensuring that only authorized
  // users can perform this action.
  socket.on(ClientEvents.CANVAS_CLEAR, async () => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;
      const state = room.getState();

      if (
        state.currentDrawerId !== socket.data.userId ||
        (state.gameState !== GameState.DRAWING && state.gameState !== GameState.PARALLEL_DRAWING)
      ) {
        console.warn(
          `[Security] Blocked unauthorized canvas clear from ${socket.data.userId} in room ${roomCode} (from file canvasHandlers.ts)`,
        );
        return;
      }

      const streamKey = `room:${roomCode}:canvas`;
      await redis.del(streamKey);

      io.to(roomCode).emit(ServerEvents.CANVAS_CLEARED);
    } catch (error) {
      console.error('[Canvas] Clear handler error (from file canvasHandlers.ts): ', error);
    }
  });

  //UNDO HANDLER
  // This handler allows the current drawer to undo their last stroke by removing the
  // corresponding entry from the Redis stream and broadcasting an undo event to all clients.
  // It includes validation to ensure that only the current drawer can perform the undo action and
  // that it can only be done during an active drawing phase. The handler searches the Redis stream for
  // the most recent batch of strokes, identifies the last stroke's ID, removes it from the stream,
  // and notifies all clients to remove that stroke from their canvases.
  socket.on(ClientEvents.CANVAS_UNDO, async () => {
    try {
      const roomCode = socket.data.roomCode;
      if (!roomCode) return;

      const room = roomManager.getRoom(roomCode);
      if (!room) return;

      const state = room.getState();

      if (
        state.currentDrawerId !== socket.data.userId ||
        (state.gameState !== GameState.DRAWING && state.gameState !== GameState.PARALLEL_DRAWING)
      ) {
        console.warn(
          `[Security] Blocked unauthorized canvas undo from ${socket.data.userId} in room ${roomCode} (from file canvasHandlers.ts)`,
        );
        return;
      }

      const streamKey = `room:${roomCode}:canvas`;
      const rawStream = await redis.xrange(streamKey, '-', '+');
      if (!rawStream || rawStream.length === 0) return;

      let strokeIdToUndo: string | null = null;
      for (let i = rawStream.length - 1; i >= 0; --i) {
        const jsonString = rawStream[i]?.[1]?.[1];
        if (!jsonString) continue;

        const strokes = JSON.parse(jsonString);
        if (Array.isArray(strokes) && strokes.length > 0 && strokes[0]?.strokeId) {
          strokeIdToUndo = strokes[0].strokeId;
          break;
        }
      }

      if (!strokeIdToUndo) return;

      for (const entry of rawStream) {
        const id = entry[0];
        const jsonString = entry[1][1];

        if (!jsonString) continue;

        const strokes = JSON.parse(jsonString);

        if (Array.isArray(strokes) && strokes[0]?.strokeId === strokeIdToUndo) {
          await redis.xdel(streamKey, id);
        }
      }

      io.to(roomCode).emit(ServerEvents.CANVAS_UNDONE, { strokeId: strokeIdToUndo });
    } catch (error) {
      console.error('[Canvas] Undo Handler error (from file canvasHandlers.ts): ', error);
    }
  });
};
