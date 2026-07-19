/**
 * This module provides a simple in-memory rate limiter for AI theme requests in game rooms.
 * It tracks the last time a room requested an AI-generated theme to prevent excessive API calls.
 * The rate limiter is designed to be lightweight and efficient, using a Map to store timestamps.
 * Also tracks rooms that currently have an in-flight AI generation job to prevent concurrent requests and
 * to ensure that the host does not start the game before the AI theme generation is complete.
 */

//NOTE: This file is intentionally kept separate from the lobbyHandlers.ts and RoomManager.ts to avoid circular
// dependencies between them and to keep the rate limiting logic modular and reusable across different parts
// of the application.

// Tracks when a room last requested an AI theme to prevent API spam
const themeRateLimits = new Map<string, number>(); //roomCode -> timestamp of last request

// Tracks rooms that currently have an in-flight AI generation job
const activeGenerations = new Set<string>();

/**
 * Gets the timestamp of the last AI theme request for a given room.
 * @param roomCode - The unique code of the room to check.
 * @returns The timestamp of the last request, or 0 if none exists.
 */
export const getLastThemeRequest = (roomCode: string): number => {
  return themeRateLimits.get(roomCode) || 0;
};

/**
 * Sets the timestamp of the last AI theme request for a given room.
 * @param roomCode - The unique code of the room to update.
 * @param timestamp - The timestamp of the request.
 */
export const setThemeRequest = (roomCode: string, timestamp: number): void => {
  themeRateLimits.set(roomCode, timestamp);
};

/**
 * Adds a room to the set of rooms with active AI generation jobs.
 * @param roomCode - The unique code of the room to add.
 */
export const addActiveGeneration = (roomCode: string): void => {
  activeGenerations.add(roomCode);
};

/**
 * Removes a room from the set of rooms with active AI generation jobs.
 * @param roomCode - The unique code of the room to remove.
 */
export const removeActiveGeneration = (roomCode: string): void => {
  activeGenerations.delete(roomCode);
};

/**
 * Checks if a room has an active AI generation job.
 * @param roomCode - The unique code of the room to check.
 * @returns True if the room has an active generation job, false otherwise.
 */
export const isGenerationActive = (roomCode: string): boolean => {
  return activeGenerations.has(roomCode);
};

/**
 * Clears the theme state for a given room.
 * @param roomCode - The unique code of the room to clear.
 */
export const clearThemeState = (roomCode: string): void => {
  themeRateLimits.delete(roomCode);
  activeGenerations.delete(roomCode);
};
