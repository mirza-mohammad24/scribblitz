/**
 * Centralized function to emit error events to the client. This ensures that all error messages follow
 * a consistent format and can be easily handled on the client side.
 */
import { Socket } from 'socket.io';
import { ServerEvents, ErrorCode, GameError } from '@scribblitz/types';

//THE BOUNCER LIST: Only these specific codes will force the frontend to disconnect
const FATAL_ERRORS: ErrorCode[] = [
  ErrorCode.NOT_FOUND,
  ErrorCode.ROOM_FULL,
  ErrorCode.ALREADY_IN_ROOM,
  ErrorCode.DUPLICATE_USERNAME,
  ErrorCode.SESSION_EXPIRED,
];
/**
 * Emits an error event to the client with a consistent format.
 * @param socket
 * @param code - A well-known ErrorCode enum member shared with the frontend.
 * @param message - A human-readable description of what went wrong.
 */
export function emitError(socket: Socket, code: ErrorCode, message: string) {
  // Dynamically calculate if this is a session-ending offense
  const isFatal = FATAL_ERRORS.includes(code);

  const errorPayload: GameError = {
    code,
    message,
    isFatal,
  };

  socket.emit(ServerEvents.ERROR, errorPayload);
}
