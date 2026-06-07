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
import { ClientEvents, ServerEvents } from '@scribblitz/types';
import { CanvasBatchSchema } from '@scribblitz/validation';
import { redis } from '../../lib/redis';

/**
 * Registers the canvas event handlers for the given Socket.IO server and socket.
 * This function listens for canvas batch updates from clients, validates the data, broadcasts it to
 * other players, and saves it to Redis for persistence.
 * @param io
 * @param socket
 */
export const registerCanvasHandlers = (io: Server, socket: Socket) => {
  socket.on(ClientEvents.CANVAS_BATCH, (payload) => {
    try {
      //1. Validate: Protect the server from malformed or malicious data that could cause crashes or exploits
      const result = CanvasBatchSchema.safeParse(payload);
      if (!result.success) {
        console.warn(`[Canvas] Invalid batch payload from ${socket.id}:`, result.error.errors);
        return;
      }

      const { strokes } = result.data; //safe data to work with
      if (strokes.length === 0) return;

      //Extract the roomCode from the first stroke (our frontend hooks attaches it)
      const roomCode = strokes[0]?.sessionId;

      //2. Broadcast Immediately: Send to all other players in the room
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
};
