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
  type: z.literal('draw'),
  x: z.number().min(-1000).max(5000), // Prevent absurd values that could indicate a bug or malicious input
  y: z.number().min(-1000).max(5000),
  //Make every network packet self contained so the watcher doesn't connect gaps
  lastX: z.number().min(-1000).max(5000),
  lastY: z.number().min(-1000).max(5000),
  //Will be helpful for UNDO functionality
  strokeId: z.string(),
  color: z.string().max(30),
  brushSize: z.number().min(1).max(100),
  sessionId: z.string(),
  timestamp: z.number(),
  roundId: z.number(),
});

export const CanvasBatchSchema = z.object({
  strokes: z.array(StrokeEventSchema).max(200), //Max 200 strokes per 16ms batch to prevent payload bombs
});

export type ValidatedCanvasBatch = z.infer<typeof CanvasBatchSchema>;
