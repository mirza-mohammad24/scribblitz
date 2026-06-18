/**
 * This file contains constants used throughout the game.
 * By centralizing these values, we can easily manage and update
 * them as needed without having to search through the entire codebase.
 */
export const GAME_CONSTANTS = {
  MIN_PLAYERS: 2,
  MAX_PLAYERS: 10,
  DEFAULT_ROUND_MODE: 'standard',
  MINIMUM_ROUND_COUNT: 1,
  DEFAULT_ROUND_COUNT: 3,
  MAXIMUM_ROUND_COUNT: 10,
  MINIMUM_DRAW_TIME_SECONDS: 60,
  DEFAULT_DRAW_TIME_SECONDS: 90,
  MAXIMUM_DRAW_TIME_SECONDS: 180,
  WORD_SELECTION_TIMEOUT_SECONDS: 15,
  ROUND_START_COUNTDOWN_SECONDS: 3,
  ROUND_END_DISPLAY_SECONDS: 5,
  CANVAS_BATCH_INTERVAL_MS: 16,
  REDIS_STREAM_MAX_LEN: 5000,
  LEVENSHTEIN_CLOSE_THRESHOLD: 2,
  HINT_INTERVAL_SECONDS: 10,
  MAX_RECENT_WORDS: 10,
  WORD_CHOICES_COUNT: 3,
  SYNC_RATE_LIMIT_MS: 2000, // Minimum time between canvas syncs to prevent abuse
} as const;
