/**
 * This file defines the Room class, which encapsulates the state and internal
 * logic for a single Scribblitz game session. It manages its own Finite State Machine (FSM),
 * player roster, and internal lifecycle events like host reassignment and memory cleanup.
 */

import { nanoid } from 'nanoid';
import { RoomState, Player, RoomConfig, GameState } from '@scribblitz/types';
import { GameFSM } from '../fsm/GameFSM';
import { clearTimer, clearIntervalTimer } from '../utils/timerCleanUp';

/**
 * ServerRoomState extends the shared RoomState to include the server-side GameFSM.
 * This ensures the FSM instance is tracked in memory but never serialized to the client.
 */
export interface ServerRoomState extends RoomState {
  fsm: GameFSM;
}

/**
 * Defines the possible outcomes when attempting to add a player to a room.
 */
export type AddPlayerResult =
  | { success: true; message: 'ADDED' }
  | {
      success: false;
      reason: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ALREADY_IN_ROOM';
    };

export class Room {
  private readonly state: ServerRoomState;

  constructor(hostId: string, config: Partial<RoomConfig>) {
    const roomCode = Room.generateRoomCode();
    const fsm = new GameFSM();

    this.state = {
      roomCode,
      hostId,
      players: new Map(),
      config: {
        roomCode,
        maxPlayer: 10,
        roundCount: 3,
        drawTimeSeconds: 90,
        mode: 'standard',
        ...config, // Override defaults with any provided config values
      },
      gameState: fsm.getState(),
      currentRound: 0,
      roundId: 0,
      currentDrawerId: null,
      currentWord: null,
      usedWords: [],
      revealedHintIndexes: new Set(),
      currentHint: '',
      wordChoices: null,
      correctGuessers: new Set(),
      roundStartTime: null,
      wordSelectionTimer: null,
      drawingTimer: null,
      intermissionTimer: null,
      hintTimer: null,
      fsm,
    };

    // Only allocate memory for team sets if the mode requires it
    if (this.state.config.mode === 'team-battle') {
      this.state.teamA = new Set();
      this.state.teamB = new Set();
    }
  }

  //===========================
  // Static Helpers
  //===========================
  /**
   * Generates a 6-character uppercase alphanumeric string for the room code.
   */
  private static generateRoomCode(): string {
    return nanoid(6).toUpperCase();
  }

  // =========================
  // Getters
  // =========================
  getRoomCode(): string {
    return this.state.roomCode;
  }

  getState(): ServerRoomState {
    return this.state;
  }

  // =========================
  // Player Lifecycle
  // =========================
  /**
   * Attempts to add a player to the room, enforcing capacity limits and uniqueness.
   * @param player The player object to add.
   * @returns An AddPlayerResult indicating success or the specific reason for failure.
   */
  addPlayer(player: Player): AddPlayerResult {
    if (this.state.players.size >= this.state.config.maxPlayer) {
      return { success: false, reason: 'ROOM_FULL' };
    }

    if (this.state.players.has(player.id)) {
      return { success: false, reason: 'ALREADY_IN_ROOM' };
    }

    // Add player to the room's player map
    this.state.players.set(player.id, player);
    return { success: true, message: 'ADDED' };
  }

  /**
   * Removes a player from the room and handles internal housekeeping (like host reassignment).
   * @param playerId The unique ID of the player to remove.
   * @returns `true` if the room is now empty and should be deleted; `false` otherwise.
   */
  removePlayer(playerId: string): boolean {
    this.state.players.delete(playerId);

    // Clean up team sets if they exist
    this.state.teamA?.delete(playerId);
    this.state.teamB?.delete(playerId);

    // If room is empty, destroy it
    if (this.state.players.size === 0) {
      return true;
    }

    // Host reassignment: If the host leaves, randomly assign a new host from remaining players
    if (this.state.hostId === playerId) {
      const remainingPlayers = Array.from(this.state.players.keys());
      this.state.hostId = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)]!;
    }

    return false;
  }

  // =========================
  // FSM Synchronization
  // =========================

  /**
   * Transitions the FSM to the next state and syncs the raw state data string.
   * @param nextState The GameState to transition to.
   */
  transitionState(nextState: GameState): void {
    this.state.fsm.transition(nextState);
    this.state.gameState = this.state.fsm.getState();
  }

  // =========================
  // Cleanup
  // =========================

  /**
   * Clears any active Node.js timers attached to this room to prevent memory leaks
   * after the room is deleted.
   */
  cleanup(): void {
    this.state.wordSelectionTimer = clearTimer(this.state.wordSelectionTimer);
    this.state.drawingTimer = clearTimer(this.state.drawingTimer);
    this.state.intermissionTimer = clearTimer(this.state.intermissionTimer);
    this.state.hintTimer = clearIntervalTimer(this.state.hintTimer);
  }
}
