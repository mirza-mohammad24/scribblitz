import { describe, it, expect, beforeEach } from 'vitest';
import { roomManager } from '../RoomManager';
import { Player, RoomConfig } from '@scribblitz/types';

// --- MOCK HELPERS ---
const mockConfig = {
  maxPlayer: 8,
  drawTimeSeconds: 60,
  roundCount: 3,
  mode: 'standard',
  roomCode: 'test-room',
} as unknown as RoomConfig;

const createMockPlayer = (id: string, username: string): Player => {
  return { id, username, score: 0, isConnected: true } as unknown as Player;
};

const extractState = (roomOrState: any) => {
  return roomOrState.getState ? roomOrState.getState() : roomOrState;
};

describe('RoomManager', () => {
  beforeEach(() => {
    const rooms = roomManager.getAllRooms();
    rooms.forEach((room) => {
      const state = extractState(room);
      roomManager.deleteRoom(state.roomCode);
    });
  });

  // TEST 1: Creation
  it('should successfully create a new room', () => {
    const room = roomManager.createRoom('host-123', mockConfig);
    const state = extractState(room);
    expect(room).toBeDefined();
    expect(state.hostId).toBe('host-123');
    expect(roomManager.getRoom(state.roomCode)).toBeDefined();
  });

  // TEST 2: Capacity Enforcement
  it('should block a player from joining a full room', () => {
    const tinyConfig = { ...mockConfig, maxPlayers: 2, maxPlayer: 2 } as unknown as RoomConfig;
    const room = roomManager.createRoom('host-123', tinyConfig);
    const roomCode = extractState(room).roomCode;

    expect(roomManager.addPlayer(roomCode, createMockPlayer('host-123', 'P1')).success).toBe(true);
    expect(roomManager.addPlayer(roomCode, createMockPlayer('player-2', 'P2')).success).toBe(true);

    const p3Result = roomManager.addPlayer(roomCode, createMockPlayer('player-3', 'P3'));
    expect(p3Result.success).toBe(false);
    if (!p3Result.success) expect(p3Result.reason).toBe('ROOM_FULL');
  });

  // TEST 3: Cleanup
  it('should cleanly remove a player and delete room if empty', () => {
    const room = roomManager.createRoom('host-123', mockConfig);
    const roomCode = extractState(room).roomCode;

    roomManager.addPlayer(roomCode, createMockPlayer('host-123', 'Host'));

    // Check the new return object confirms it was empty
    const result = roomManager.removePlayer(roomCode, 'host-123');
    expect(result?.isEmpty).toBe(true);
    expect(roomManager.getRoom(roomCode)).toBeUndefined();
  });

  // TEST 4: Host Reassignment (The Critical Edge Case)
  it('should automatically reassign a new host if the current host leaves', () => {
    const room = roomManager.createRoom('host-A', mockConfig);
    const roomCode = extractState(room).roomCode;

    roomManager.addPlayer(roomCode, createMockPlayer('host-A', 'Alice'));
    roomManager.addPlayer(roomCode, createMockPlayer('player-B', 'Bob'));
    roomManager.addPlayer(roomCode, createMockPlayer('player-C', 'Charlie'));

    // The host leaves the room
    const removeResult = roomManager.removePlayer(roomCode, 'host-A');

    // Validate the newly structured return object from the method!
    expect(removeResult).toBeDefined();
    expect(removeResult?.wasHost).toBe(true);
    expect(removeResult?.isEmpty).toBe(false);

    // Confirm that the new host is NOT 'host-A', and is either Bob or Charlie
    const newHostId = extractState(roomManager.getRoom(roomCode)).hostId;
    expect(newHostId).not.toBe('host-A');
    expect(['player-B', 'player-C']).toContain(newHostId);
    expect(removeResult?.newHostId).toBe(newHostId);
  });

  // TEST 5: Duplicate ID Prevention
  it('should block the same player ID from joining twice', () => {
    const room = roomManager.createRoom('host-123', mockConfig);
    const roomCode = extractState(room).roomCode;
    const p1 = createMockPlayer('p1', 'Alice');

    expect(roomManager.addPlayer(roomCode, p1).success).toBe(true);
    const duplicateResult = roomManager.addPlayer(roomCode, p1);
    expect(duplicateResult.success).toBe(false);
    if (!duplicateResult.success) expect(duplicateResult.reason).toBe('ALREADY_IN_ROOM');
  });

  // TEST 6: Duplicate Username Prevention
  it('should block a player from joining if the username is already taken (case-insensitive)', () => {
    const room = roomManager.createRoom('host-123', mockConfig);
    const roomCode = extractState(room).roomCode;

    // Join once
    expect(roomManager.addPlayer(roomCode, createMockPlayer('p1', 'Alice')).success).toBe(true);

    // Try to join with a DIFFERENT ID but the SAME username (testing case-insensitivity)
    const duplicateNameResult = roomManager.addPlayer(roomCode, createMockPlayer('p2', 'aLiCe'));
    expect(duplicateNameResult.success).toBe(false);

    if (!duplicateNameResult.success) {
      expect(duplicateNameResult.reason).toBe('DUPLICATE_USERNAME');
    }
  });
});
