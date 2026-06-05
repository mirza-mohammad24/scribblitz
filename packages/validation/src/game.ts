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
