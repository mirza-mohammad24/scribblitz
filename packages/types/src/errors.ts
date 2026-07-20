/**
 * Centralized error codes for client-server communication in the Scribblitz game.
 * These codes are shared between the game server and the web frontend so that both
 * sides can reference the same set of well-known error identifiers. The frontend can
 * exhaustively switch on these codes to display contextual error messages to the user.
 */
export enum ErrorCode {
  /** Payload failed Zod validation (malformed or missing fields). */
  BAD_REQUEST = 'BAD_REQUEST',

  /** The requested room does not exist. */
  NOT_FOUND = 'NOT_FOUND',

  /** The user lacks permission for this action (not host, not drawer, not authenticated). */
  UNAUTHORIZED = 'UNAUTHORIZED',

  /** The action is not allowed in the current game state (e.g., starting a game that is already running). */
  INVALID_STATE = 'INVALID_STATE',

  /** The socket is already bound to a room and cannot create/join another. */
  ALREADY_IN_ROOM = 'ALREADY_IN_ROOM',

  /** The room has reached its maximum player capacity. */
  ROOM_FULL = 'ROOM_FULL',

  /** Another player in the room already has the same username. */
  DUPLICATE_USERNAME = 'DUPLICATE_USERNAME',

  /** There are not enough players in the room to start the game. */
  NOT_ENOUGH_PLAYERS = 'NOT_ENOUGH_PLAYERS',

  /** The user's session has expired. This will trigger silent background cleanup */
  SESSION_EXPIRED = 'SESSION_EXPIRED',

  /** AI theme-based word generation failed or timed out. Non-fatal — host can retry or fall back to default/custom words. */
  THEME_GENERATION_FAILED = 'THEME_GENERATION_FAILED',

  /** The user has exceeded the rate limit for this action. */
  RATE_LIMITED = 'RATE_LIMITED',

  /** Voice chat functionality failed. */
  VOICE_CHAT_FAILED = 'VOICE_CHAT_FAILED',

  /** Generic server error for unexpected conditions. */
  INTERNAL_SERVER_ERROR = 'INTERNAL_SERVER_ERROR',
}

/**
 * The standardized error payload emitted by the server.
 */
export interface GameError {
  code: ErrorCode;
  message: string;
  isFatal: boolean;
}
