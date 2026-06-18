/**
 * Looks up an active Socket.IO socket instance by the userId stored in socket.data.
 * This is the inverse of getUserIdBySocket — instead of reading a userId from a known socket,
 * this finds the socket for a known userId. Used to push targeted events to specific players
 * (e.g., sending word choices only to the current drawer).
 */
import { Server, Socket } from 'socket.io';

/**
 * Finds and returns the active socket for a given userId.
 * Returns undefined if the player is not currently connected.
 * A disconnected drawer is handled gracefully by the AFK word-selection timer.
 * @param io - The Socket.IO server instance
 * @param userId - The UUID identifying the player
 * @param roomCode - The code identifying the room the player is in, used to ensure we find the correct socket in case of multiple rooms
 * @returns The active Socket for that player, or undefined if not connected
 */
export function getSocketByUserId(
  io: Server,
  userId: string,
  roomCode: string,
): Socket | undefined {
  // High-Performance Targeted Lookup
  // Instead of an O(N) iteration over every connected user on the server,
  // we pull just the small Set of socket IDs active inside this specific room.
  const roomSocketIds = io.sockets.adapter.rooms.get(roomCode);

  if (!roomSocketIds) return undefined;

  // Now we only iterate over the 2-8 players in the room, bypassing thousands of other sockets.
  for (const socketId of roomSocketIds) {
    const socket = io.sockets.sockets.get(socketId);
    if (socket && socket.data.userId === userId) {
      return socket;
    }
  }

  return undefined;
}
