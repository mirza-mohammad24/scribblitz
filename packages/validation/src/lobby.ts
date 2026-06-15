/**
 * This file contains Zod schemas for validating lobby-related data, such as creating and joining rooms.
 * These schemas ensure that the data sent from the client to the server adheres to the expected format
 * and constraints, providing a layer of validation before processing the requests.
 */

import { z } from 'zod';
import { GAME_CONSTANTS } from '@scribblitz/shared';

const usernameSchema = z
  .string()
  .trim()
  .min(2, {
    message: 'Username must contain at least 2 characters',
  })
  .max(20, {
    message: 'Username cannot exceed 20 characters',
  })
  .regex(/^[a-zA-Z0-9_ ]+$/, 'Username can only contain letters, numbers, underscores, and spaces');

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
    .min(GAME_CONSTANTS.MIN_PLAYERS, {
      message: `A room must allow at least ${GAME_CONSTANTS.MIN_PLAYERS} players`,
    })
    .max(GAME_CONSTANTS.MAX_PLAYERS, {
      message: `A room cannot exceed ${GAME_CONSTANTS.MAX_PLAYERS} players`,
    })
    .optional(),

  roundCount: z
    .number({
      invalid_type_error: 'Round count must be a number',
    })
    .int({
      message: 'Round count must be a whole number',
    })
    .min(GAME_CONSTANTS.MINIMUM_ROUND_COUNT, {
      message: `There must be at least ${GAME_CONSTANTS.MINIMUM_ROUND_COUNT} round`,
    })
    .max(GAME_CONSTANTS.MAXIMUM_ROUND_COUNT, {
      message: `Round count cannot exceed ${GAME_CONSTANTS.MAXIMUM_ROUND_COUNT}`,
    })
    .optional(),

  drawTimeSeconds: z
    .number({
      invalid_type_error: 'Draw time must be a number',
    })
    .int({
      message: 'Draw time must be a whole number',
    })
    .min(GAME_CONSTANTS.MINIMUM_DRAW_TIME_SECONDS, {
      message: `Draw time must be at least ${GAME_CONSTANTS.MINIMUM_DRAW_TIME_SECONDS} seconds`,
    })
    .max(GAME_CONSTANTS.MAXIMUM_DRAW_TIME_SECONDS, {
      message: `Draw time cannot exceed ${GAME_CONSTANTS.MAXIMUM_DRAW_TIME_SECONDS} seconds`,
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
  avatarSeed: z.string().min(1),
  config: roomConfigSchema.optional(),
});

export const joinRoomSchema = z.object({
  roomCode: roomCodeSchema,
  username: usernameSchema,
  avatarSeed: z.string().min(1),
});
