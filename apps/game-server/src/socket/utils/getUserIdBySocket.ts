/**
 * Retrieves the user ID associated with a given Socket.IO socket.
 * This function assumes that the user ID has been previously stored in
 * `socket.data.userId` during the authentication phase.
 */
import { Socket } from 'socket.io';

/**
 * Retrieves the user ID associated with a given Socket.IO socket.
 * @param socket
 * @returns The user ID if found, otherwise null.
 */
export function getUserIdBySocket(socket: Socket): string | null {
  //socket.data.userId is guaranteed to exist because of our Express middleware
  const userId = socket.data.userId;

  if (typeof userId !== 'string' || userId.length === 0) {
    return null;
  }

  return userId;
}
