/**
 * Centralized function to emit error events to the client. This ensures that all error messages follow
 * a consistent format and can be easily handled on the client side.
 */
import { Socket } from 'socket.io';
import { ServerEvents } from '@scribblitz/types';

/**
 * Emits an error event to the client with a consistent format.
 * @param socket
 * @param code
 * @param message
 */
export function emitError(socket: Socket, code: string, message: string) {
  socket.emit(ServerEvents.ERROR, {
    code,
    message,
  });
}
