/**
 * This file contains Zod schemas for validating lobby-related data, such as creating and joining rooms. These schemas ensure that the data sent from the client to the server adheres to the expected format and constraints, providing a layer of validation before processing the requests.
 */

import { z } from 'zod';

const usernameSchema = z
  .string()
  .trim()
  .min(2, {
    message: 'Username must contain at least 2 characters',
  })
  .max(20, {
    message: 'Username cannot exceed 20 characters',
  });

const roomCodeSchema = z.string().trim().toUpperCase().length(6, {
  message: 'Room code must be exactly 6 characters long',
});

export const roomConfigSchema = z.object({
  maxPlayer: z
    .number({
      invalid_type_error: 'Maximum players must be a number',
    })
    .int({
      message: 'Maximum players must be a whole number',
    })
    .min(2, {
      message: 'A room must allow at least 2 players',
    })
    .max(10, {
      message: 'A room cannot exceed 10 players',
    })
    .optional(),

  roundCount: z
    .number({
      invalid_type_error: 'Round count must be a number',
    })
    .int({
      message: 'Round count must be a whole number',
    })
    .min(1, {
      message: 'There must be at least 1 round',
    })
    .max(10, {
      message: 'Round count cannot exceed 10',
    })
    .optional(),

  drawTimeSeconds: z
    .number({
      invalid_type_error: 'Draw time must be a number',
    })
    .int({
      message: 'Draw time must be a whole number',
    })
    .min(60, {
      message: 'Draw time must be at least 60 seconds',
    })
    .max(180, {
      message: 'Draw time cannot exceed 180 seconds',
    })
    .optional(),

  mode: z
    .enum(['standard', 'team-battle'], {
      errorMap: () => ({
        message: 'Game mode must be either "standard" or "team-battle"',
      }),
    })
    .optional(),
});

export const createRoomSchema = z.object({
  username: usernameSchema,
  config: roomConfigSchema.optional(),
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  username: usernameSchema,
});
