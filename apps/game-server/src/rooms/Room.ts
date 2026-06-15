/**
 * This file defines the Room class, which encapsulates the state and internal
 * logic for a single Scribblitz game session. It manages its own Finite State Machine (FSM),
 * player roster, and internal lifecycle events like host reassignment and memory cleanup.
 */

import { customAlphabet } from 'nanoid';
import { RoomState, Player, RoomConfig, GameState, ErrorCode } from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
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
      reason:
        | ErrorCode.NOT_FOUND
        | ErrorCode.ROOM_FULL
        | ErrorCode.ALREADY_IN_ROOM
        | ErrorCode.DUPLICATE_USERNAME;
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
        maxPlayer: GAME_CONSTANTS.MAX_PLAYERS,
        roundCount: GAME_CONSTANTS.DEFAULT_ROUND_COUNT,
        drawTimeSeconds: GAME_CONSTANTS.DEFAULT_DRAW_TIME_SECONDS,
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
    //Only uppercase letters and numbers are allowed
    const generateSafeCode = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 6);
    return generateSafeCode();
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

  /**
   * Merges new configuration settings into the room's current config.
   * Only overrides the specific keys provided.
   * @param newConfig Partial configuration object
   */
  updateConfig(newConfig: Partial<RoomConfig>): void {
    this.state.config = {
      ...this.state.config,
      ...newConfig,
    };
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
      return { success: false, reason: ErrorCode.ROOM_FULL };
    }

    if (this.state.players.has(player.id)) {
      return { success: false, reason: ErrorCode.ALREADY_IN_ROOM };
    }

    const existingUsernames = [...this.state.players.values()].map((p) => p.username.toLowerCase());
    if (existingUsernames.includes(player.username.toLowerCase())) {
      return { success: false, reason: ErrorCode.DUPLICATE_USERNAME };
    }

    // Add player to the room's player map
    this.state.players.set(player.id, player);
    return { success: true, message: 'ADDED' };
  }

  /**
   * Removes a player from the room and handles internal housekeeping (like host reassignment).
   * @param playerId The unique ID of the player to remove.
   * @returns An object detailing if the room is empty, and if the host was changed.
   */
  removePlayer(playerId: string): {
    isEmpty: boolean;
    wasHost: boolean;
    newHostId?: string | null;
  } {
    this.state.players.delete(playerId);

    // Clean up team sets if they exist
    this.state.teamA?.delete(playerId);
    this.state.teamB?.delete(playerId);

    // If room is empty, destroy it
    if (this.state.players.size === 0) {
      return { isEmpty: true, wasHost: false };
    }

    let wasHost = false;
    let newHostId: string | undefined;

    // Host reassignment: If the host leaves, randomly assign a new host from remaining players
    if (this.state.hostId === playerId) {
      wasHost = true;

      //Filter out players who are currently in their 60 second AFK grace period
      // to avoid assigning host to a disconnected player

      const connectedPlayers = Array.from(this.state.players.values()).filter((p) => p.isConnected);

      if (connectedPlayers.length > 0) {
        newHostId = connectedPlayers[Math.floor(Math.random() * connectedPlayers.length)]!.id;
        this.state.hostId = newHostId;
      } else {
        //Absolute fallback: if all remaining players are disconnected, assign host to a random
        // player anyway to avoid leaving the room without a host
        const remainingPlayers = Array.from(this.state.players.keys());
        newHostId = remainingPlayers[Math.floor(Math.random() * remainingPlayers.length)]!;
        this.state.hostId = newHostId;
      }
    }

    return { isEmpty: false, wasHost, newHostId };
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

  /**
   * Resets all game-related state back to the initial values, preparing for a new game session
   */
  resetForNewGame(): void {
    this.cleanup(); // Clear any active timers from the previous game

    this.state.currentRound = 0;
    this.state.roundId = 0;
    this.state.currentDrawerId = null;
    this.state.currentWord = null;
    this.state.usedWords = [];
    this.state.revealedHintIndexes.clear();
    this.state.currentHint = '';
    this.state.wordChoices = null;
    this.state.correctGuessers.clear();
    this.state.roundStartTime = null;

    // Reset all player scores and guess flags
    this.state.players.forEach((p) => {
      p.score = 0;
      p.hasGuessedCorrectly = false;
    });

    this.transitionState(GameState.LOBBY);
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
