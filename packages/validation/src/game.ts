/**
 * This module defines the schema for validating game and chat related data
 */

import { z } from 'zod';

export const wordSelectSchema = z.object({
  word: z.string().min(1, 'Word selection cannot be empty'),
});

export const chatMessageSchema = z.object({
  message: z
    .string()
    .min(1, 'Chat message cannot be empty')
    .max(250, 'Chat message cannot exceed 250 characters'),
  roundId: z.number().int().nonnegative('Round ID must be a non-negative integer'),
});

export type WordSelectPayload = z.infer<typeof wordSelectSchema>;
export type ChatMessagePayload = z.infer<typeof chatMessageSchema>;

export const StrokeEventSchema = z.object({
  type: z.enum(['draw', 'erase', 'fill', 'clear']),
  x: z.number().min(-1000).max(5000), // Prevent absurd values that could indicate a bug or malicious input
  y: z.number().min(-1000).max(5000),
  //Make every network packet self contained so the watcher doesn't connect gaps
  lastX: z.number().min(-1000).max(5000),
  lastY: z.number().min(-1000).max(5000),
  //Will be helpful for UNDO functionality
  strokeId: z.string().max(64),
  color: z.string().max(30),
  brushSize: z.number().min(1).max(100),
  sessionId: z.string().max(16),
  timestamp: z.number(),
  roundId: z.number(),
});

// Canvas batch schema for validating incoming batches of strokes from clients.
// Each stroke in the batch is validated against the StrokeEventSchema to ensure data integrity and prevent exploits.
export const CanvasBatchSchema = z.object({
  strokes: z.array(StrokeEventSchema).max(200), //Max 200 strokes per 16ms batch to prevent payload bombs
});

export type ValidatedCanvasBatch = z.infer<typeof CanvasBatchSchema>;

//Validates the shape of the history array before sending it back to the client on reconnection or late join.
//This is crucial to prevent malformed data from crashing the client or causing exploits when we apply
//the history to the canvas.
export const HistoryPayloadSchema = z.array(StrokeEventSchema);

//Validates the client's request to sync canvas history on reconnection
export const CanvasSyncRequestSchema = z.object({
  roomCode: z
    .string()
    .trim()
    .toUpperCase()
    .length(6, { message: 'Room code must be 6 characters' }),
});

export const emoteSchema = z.object({
  // Limit to a single emoji (max 10 chars handles complex emojis with modifiers)
  emoji: z.string().min(1, 'Emote cannot be empty').max(10, 'Emote cannot exceed 10 characters'),
});
