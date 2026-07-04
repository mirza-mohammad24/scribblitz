/**
 * This file defines the types and interfaces related to the game state, player information,room configuration
 * and room state for scribblitz.
 */

/**
 * GameState enum represents the different states of the game, such as when players are in the lobby,
 * when a round is starting, when players are drawing, and when the game has ended. This helps in
 * managing the game flow and ensuring that the client and server are synchronized in terms of the
 * current state of the game.
 */
export enum GameState {
  LOBBY = 'LOBBY',
  ROUND_STARTING = 'ROUND_STARTING',
  DRAWING = 'DRAWING',
  PARALLEL_DRAWING = 'PARALLEL_DRAWING',
  ROUND_END = 'ROUND_END',
  GAME_END = 'GAME_END',
}

/**
 * StrokeEvent interface defines the structure of a drawing event that occurs during the game. It includes
 * information about the type of stroke (drawing, erasing, filling, or clearing), the coordinates of the stroke,
 * the color used, the brush size, the session ID of the player who made the stroke, a timestamp for
 * when the event occurred and the round ID to which the stroke belongs.
 * This information is crucial for synchronizing the drawing actions across all
 * clients in real-time.
 */
export interface StrokeEvent {
  type: 'draw' | 'erase' | 'fill' | 'clear';
  x: number;
  y: number;
  lastX: number;
  lastY: number;
  strokeId: string;
  color: string;
  brushSize: number;
  sessionId: string;
  timestamp: number;
  roundId: number; // Used to prevent stroke events from being applied to the wrong round in case of timer leaks
}

/**
 * Player interface represents the information about a player in the game, including their unique ID, username,
 * score, and connection status. It also includes a flag to indicate whether the player has guessed the word
 * correctly in the current round, and an optional team ID for players participating in team battle mode.
 */
export interface Player {
  id: string;
  username: string;
  avatarSeed: string;
  score: number;
  isConnected: boolean;
  hasGuessedCorrectly: boolean;
  teamId?: 'team-a' | 'team-b'; // Only used in team battle mode
}

/**
 * RoomConfig interface defines the configuration settings for a game room, including the room code, maximum
 * number of players, and other game-specific settings.
 */
export interface RoomConfig {
  roomCode: string;
  maxPlayer: number;
  roundCount: number;
  drawTimeSeconds: number;
  mode: 'standard' | 'team-battle'; //which game mode to play
  customWordList?: string[]; // Optional custom word list for the game (provided by the host)
  difficulty: 'easy' | 'medium' | 'hard'; // Difficulty for the game (affects the reveal % of the chosen word)
  customWordsOnly: boolean;
}

/**
 * RoomState interface represents the overall state of a game room, including the room code,
 * host ID, list of players and so on.
 */
export interface RoomState {
  roomCode: string;
  hostId: string;
  players: Map<string, Player>;
  config: RoomConfig;
  gameState: GameState;
  currentRound: number;
  roundId: number; //used in preventing timer leaks across rounds by providing a way to identify stale timers
  currentDrawerId: string | null;
  currentWord: string | null;
  revealedHintIndexes: Set<number>;
  currentHint: string;
  wordChoices: string[] | null;
  usedWords: string[]; //Tracks all words used in previous rounds to prevent repeats
  correctGuessers: Set<string>;
  roundStartTime: number | null;
  wordSelectionTimer: ReturnType<typeof setTimeout> | null;
  drawingTimer: ReturnType<typeof setTimeout> | null;
  intermissionTimer: ReturnType<typeof setTimeout> | null;
  hintTimer: ReturnType<typeof setInterval> | null;
  teamA?: Set<string>;
  teamB?: Set<string>;
  roundWinner?: 'team-a' | 'team-b' | null;
}
