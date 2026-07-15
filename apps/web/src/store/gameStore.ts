/**
 * Game Store File. This file contains the implementation of a Zustand store for managing the state of a game room.
 * The store includes properties for the core room state, active game state, and actions to update the state or
 * reset the game.
 */

import { create } from 'zustand';
import { GameState, Player, RoomConfig } from '@scribblitz/types';

export interface PlayerStanding {
  id: string;
  username: string;
  score: number;
  rank: number;
}

export interface ChatMessage {
  senderId: string;
  senderName: string;
  message: string;
  isSystem: boolean;
  isCloseGuess?: boolean;
}

interface GameStore {
  //Core Room State
  //If gameState is null, we are on the Splash screen (screen before waiting room)
  gameState: GameState | null;
  roomCode: string | null;
  hostId: string | null;
  players: Player[];
  config: RoomConfig | null;

  //Active Game State
  currentDrawerId: string | null;
  wordChoices: string[];

  currentRound: number;
  totalRounds: number;
  roundId: number; //Required for chat message and stroke synchronization
  currentHint: string;
  wordLength: number | null;
  correctWord: string | null;
  roundEndReason: string | null;
  isFinalRound: boolean;
  scores: Array<{ id: string; username: string; score: number }>;
  standings: PlayerStanding[];
  previousScores: Record<string, number>;
  chatMessages: ChatMessage[];
  drawTimeSeconds: number;
  roundStartTime: number | null;
  isGameAborted: boolean;
  abortReason: string | null;

  //Actions
  setRoomState: (payload: Partial<GameStore>) => void;
  resetGame: () => void;
}

// Extracting initialState makes resetGame() completely bulletproof
const initialState = {
  gameState: null,
  roomCode: null,
  hostId: null,
  players: [],
  config: null,
  currentDrawerId: null,
  wordChoices: [],
  currentRound: 0,
  totalRounds: 0,
  roundId: 0,
  currentHint: '',
  wordLength: null,
  correctWord: null,
  roundEndReason: null,
  isFinalRound: false,
  scores: [],
  standings: [],
  previousScores: {},
  chatMessages: [],
  drawTimeSeconds: 0,
  roundStartTime: null,
  isGameAborted: false,
  abortReason: null,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setRoomState: (payload) => set((state) => ({ ...state, ...payload })),

  resetGame: () => set(initialState),
}));
