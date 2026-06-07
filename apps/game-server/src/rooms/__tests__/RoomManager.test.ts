import { describe, it, expect, beforeEach } from 'vitest';
import { roomManager } from '../RoomManager';
import { Player, RoomConfig } from '@scribblitz/types';

// --- MOCK HELPERS ---
// Using "as unknown as Type" safely forces TypeScript to accept our mock data
// even if we don't perfectly fill out every single nested requirement.

const mockConfig = {
  maxPlayer: 8,
  drawTimeSeconds: 60,
  roundCount: 3,
  mode: 'standard',
  roomCode: 'test-room',
} as unknown as RoomConfig;

const createMockPlayer = (id: string, username: string): Player => {
  return {
    id,
    username,
    score: 0,
    isConnected: true,
  } as unknown as Player;
};

// Helper to handle whether your manager returns the Room instance or the State directly
const extractState = (roomOrState: any) => {
  return roomOrState.getState ? roomOrState.getState() : roomOrState;
};

describe('RoomManager', () => {
  // ARRANGE: Clean up all rooms before each test
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
    // 1. Create a tiny room (max capacity 2)
    const tinyConfig = { ...mockConfig, maxPlayers: 2, maxPlayer: 2 } as unknown as RoomConfig;
    const room = roomManager.createRoom('host-123', tinyConfig);
    const state = extractState(room);
    const roomCode = state.roomCode;

    // 2. Add Host (Player 1)
    const p1Result = roomManager.addPlayer(roomCode, createMockPlayer('host-123', 'P1'));
    expect(p1Result.success).toBe(true);

    // 3. Add Player 2
    const p2Result = roomManager.addPlayer(roomCode, createMockPlayer('player-2', 'P2'));
    expect(p2Result.success).toBe(true);

    // 4. Try to add Player 3 (Should fail!)
    const p3Result = roomManager.addPlayer(roomCode, createMockPlayer('player-3', 'P3'));

    // TYPE NARROWING: We must explicitly check if success is false before TS lets us check 'reason'
    expect(p3Result.success).toBe(false);
    if (!p3Result.success) {
      expect(p3Result.reason).toBe('ROOM_FULL');
    }
  });

  // TEST 3: Cleanup
  it('should cleanly remove a player and delete room if empty', () => {
    const room = roomManager.createRoom('host-123', mockConfig);
    const state = extractState(room);
    const roomCode = state.roomCode;

    roomManager.addPlayer(roomCode, createMockPlayer('host-123', 'Host'));

    // Remove the only player
    roomManager.removePlayer(roomCode, 'host-123');

    // The room should no longer exist
    expect(roomManager.getRoom(roomCode)).toBeUndefined();
  });
  // TEST 4: Host Reassignment (The Critical Edge Case)
  it('should automatically reassign a new host if the current host leaves', () => {
    const room = roomManager.createRoom('host-A', mockConfig);
    const state = extractState(room);
    const roomCode = state.roomCode;

    // Add Host, Player B, and Player C
    roomManager.addPlayer(roomCode, createMockPlayer('host-A', 'Alice'));
    roomManager.addPlayer(roomCode, createMockPlayer('player-B', 'Bob'));
    roomManager.addPlayer(roomCode, createMockPlayer('player-C', 'Charlie'));

    expect(extractState(roomManager.getRoom(roomCode)).hostId).toBe('host-A'); // Confirm initial host

    // The host leaves the room
    roomManager.removePlayer(roomCode, 'host-A');

    // Confirm that the new host is NOT 'host-A', and is either Bob or Charlie
    const newHostId = extractState(roomManager.getRoom(roomCode)).hostId;
    expect(newHostId).not.toBe('host-A');
    expect(['player-B', 'player-C']).toContain(newHostId);
  });

  // TEST 5: Duplicate Prevention
  it('should block the same player ID from joining twice', () => {
    const room = roomManager.createRoom('host-123', mockConfig);
    const state = extractState(room);
    const roomCode = state.roomCode;
    const p1 = createMockPlayer('p1', 'Alice');

    // Join once
    expect(roomManager.addPlayer(roomCode, p1).success).toBe(true);

    // Try to join again with the exact same ID
    const duplicateResult = roomManager.addPlayer(roomCode, p1);
    expect(duplicateResult.success).toBe(false);

    if (!duplicateResult.success) {
      expect(duplicateResult.reason).toBe('ALREADY_IN_ROOM');
    }
  });
});
