/**
 * RoomManager is a Singleton registry responsible for tracking all active game rooms
 * on the server. It provides high-level methods to create, retrieve, and delete rooms,
 * acting as the primary interface between the Socket.io handlers and the individual Room entities.
 */

import { Player, RoomConfig, ErrorCode } from '@scribblitz/types';
import { Room, ServerRoomState } from './Room';

export class RoomManager {
  // Using a Map for O(1) lookups and efficient addition/removal of rooms
  private readonly rooms = new Map<string, Room>();
  // Additional index to quickly find a player's room without iterating through all rooms
  private readonly playerRoomIndex = new Map<string, string>();

  /**
   * Instantiates a new Room and registers it in the manager. Ensures no room code collisions occur.
   * @param hostId The ID of the player creating the room.
   * @param config Optional configuration overrides for the room.
   * @returns The raw state object of the newly created room.
   */
  createRoom(hostId: string, config: Partial<RoomConfig>): ServerRoomState {
    let room: Room;

    // Extremely rare chance of nanoid collision, but we must guarantee uniqueness of room codes.
    do {
      room = new Room(hostId, config);
    } while (this.rooms.has(room.getRoomCode()));

    this.rooms.set(room.getRoomCode(), room);

    // Atomically index the host's ID to the newly created room code.
    // This prevents a rare race condition where the host disconnects before `addPlayer`
    // is called, which would normally leave an untracked zombie room in memory.
    this.playerRoomIndex.set(hostId, room.getRoomCode());

    return room.getState();
  }

  /**
   * Retrieves an active Room instance by its code.
   * @param roomCode The 6-character room identifier.
   * @returns The Room instance if found, otherwise undefined.
   */
  getRoom(roomCode: string): Room | undefined {
    return this.rooms.get(roomCode);
  }

  /**
   * Safely deletes a room from memory, ensuring all internal timers are cleaned up first.
   * @param roomCode The 6-character room identifier.
   */
  deleteRoom(roomCode: string): void {
    const room = this.rooms.get(roomCode);

    if (!room) return;

    room.cleanup();
    this.rooms.delete(roomCode);
  }

  /**
   * Proxies the addPlayer request to the specific room.
   * @param roomCode The 6-character room identifier.
   * @param player The player object to add.
   */
  addPlayer(roomCode: string, player: Player) {
    const room = this.rooms.get(roomCode);
    if (!room) {
      return { success: false, reason: ErrorCode.NOT_FOUND } as const;
    }

    const result = room.addPlayer(player);

    // If the player was successfully added, index their ID to the room code for easy lookup on disconnect
    if (result.success) {
      this.playerRoomIndex.set(player.id, roomCode);
    }

    return result;
  }

  /**
   * Proxies the removePlayer request to the specific room, and automatically deletes
   * the room if it becomes empty.
   * @param roomCode The 6-character room identifier.
   * @param playerId The ID of the player leaving.
   * @returns The result object from the Room, or undefined if the room didn't exist.
   */
  removePlayer(
    roomCode: string,
    playerId: string,
  ): { isEmpty: boolean; wasHost: boolean; newHostId?: string | null } | undefined {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    //Remove from our player-room index
    this.playerRoomIndex.delete(playerId);

    // Remove the player from the room, and check if the room is now empty and should be deleted
    const result = room.removePlayer(playerId);

    if (result.isEmpty) {
      this.deleteRoom(roomCode);
    }

    return result;
  }

  /**
   * O(1) Lookup: Finds a room directly using a player's ID.
   * Eliminates the need to iterate through all rooms on reconnects.
   * @param userId The ID of the player.
   * @returns The Room instance if found, otherwise undefined.
   */
  getRoomByUserId(userId: string): Room | undefined {
    const roomCode = this.playerRoomIndex.get(userId);
    return roomCode ? this.rooms.get(roomCode) : undefined;
  }

  /**
   * Retrieves all active Room instances. Useful for server metrics or global admin views.
   * @returns A readonly array of all active Room instances.
   */
  getAllRooms(): readonly Room[] {
    return [...this.rooms.values()];
  }
}

// Export as a Singleton so all socket handlers access the exact same memory Map
export const roomManager = new RoomManager();
