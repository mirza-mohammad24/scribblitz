/**
 * This module serves as the central controller for managing the game rounds and overall game flow.
 * It includes functions to start the game, transition between rounds, handle word selection, and
 * end rounds and games. Each function is designed with robust guards to ensure that actions are
 * only taken when appropriate (e.g., validating game state, checking player counts) and includes
 * comprehensive timer management to prevent memory leaks and ensure smooth game progression
 * even in cases of player disconnections or AFK behavior.
 * The module interacts closely with the RoomManager to access and update the game state, and it emits
 * relevant events to clients via Socket.io to keep all players in sync with the current game status.
 * Additionally, it includes cleanup logic to clear timers and Redis data to maintain server performance
 * and prevent stale data from affecting new rounds or games.
 *
 */
import { ServerEvents, GameState } from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { roomManager } from '../rooms/RoomManager';
import { pickRandomWords, getWordPoolWithCustomPriority } from '../words/wordPool';
import { Server } from 'socket.io';
import { clearTimer, clearIntervalTimer } from '../utils/timerCleanUp';
import { generateHint, getRandomHiddenIndex } from '../utils/hintUtils';
import { getSocketByUserId } from '../socket/utils/getSocketByUserId';
import { redis } from '../lib/redis';

/**
 * Helper utility to pick a random item from an array. Returns undefined if the array is empty.
 * Useful for randomly selecting a drawer from the player list or picking a random word if the drawer is AFK.
 * @param array The array to pick from
 * @return A random item from the array or undefined if the array is empty
 */
const pickRandomItem = <T>(array: T[]): T | undefined => {
  if (array.length === 0) return undefined;
  const randomIndex = Math.floor(Math.random() * array.length);
  return array[randomIndex];
};

/**
 * Starts the game for a given room by transitioning the FSM to the ROUND_STARTING state, initializing
 * round variables, and emitting the appropriate events to clients.
 * It also sets up a timer to auto-select a word if the drawer fails to choose one within the allotted
 * time, ensuring the game flow continues smoothly even if a player is AFK.
 * @param io The Socket.IO server instance
 * @param roomCode The unique code identifying the game room
 */
export const startGame = (io: Server, roomCode: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
  if (state.players.size < GAME_CONSTANTS.MIN_PLAYERS) return;

  //Transition FSM TO ROUND_STARTING
  room.transitionState(GameState.ROUND_STARTING);
  state.currentRound = 0;
  state.roundId = 0;

  //Reset all players
  state.players.forEach((p) => {
    p.score = 0;
  });

  //Broadcast FSM change to the whole room
  io.to(roomCode).emit(ServerEvents.GAME_STATE_CHANGED, {
    state: GameState.ROUND_STARTING,
  });

  startNextRound(io, roomCode);
};

/**
 * Starts the next round for a given room by selecting the next drawer, generating word choices,
 * and setting up timers for word selection and hints.
 * It ensures that the game state is properly updated and that clients are informed of the new
 * round and drawer.
 * The function also includes guards to prevent timer callbacks from executing if the round has
 * already ended or moved on, ensuring robust timer management.
 * @param io The Socket.IO server instance
 * @param roomCode The unique code identifying the game room
 */
export const startNextRound = (io: Server, roomCode: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();

  //Guard: Ensure we have enough players to start the next round
  const activePlayers = Array.from(state.players.values()).filter((p) => p.isConnected);
  if (activePlayers.length < GAME_CONSTANTS.MIN_PLAYERS) {
    // If we don't have enough active players, end the game immediately
    endGame(io, roomCode);
    return;
  }

  // FSM Transition for more than one Round - If we're starting the next round after the first one,
  // we need to transition the FSM back to ROUND_STARTING
  if (state.gameState === GameState.ROUND_END) {
    room.transitionState(GameState.ROUND_STARTING);
    io.to(roomCode).emit(ServerEvents.GAME_STATE_CHANGED, {
      state: GameState.ROUND_STARTING,
    });
  }
  state.roundId++;
  const currentRoundId = state.roundId; //capture the current round ID for timer callbacks

  state.currentRound++;
  state.correctGuessers.clear();
  state.roundWinner = null;
  // Reset per-round guess flag on every player so serialized state is always accurate
  state.players.forEach((p) => {
    p.hasGuessedCorrectly = false;
  });

  //Select the next drawer (simple round-robin based on map insertion order)
  // We MUST filter out disconnected players.
  // If we pick a disconnected player, the AFK timer will auto-select a word,
  // and the game will stall for 60-180 seconds on an empty canvas.
  const connectedPlayerIds = [...state.players.entries()]
    .filter(([, p]) => p.isConnected)
    .map(([id]) => id);

  // Fallback to all players if somehow the connected array is empty (though the MIN_PLAYERS guard above prevents this)
  const activePool = connectedPlayerIds.length > 0 ? connectedPlayerIds : [...state.players.keys()];

  const drawerIndex = (state.currentRound - 1) % activePool.length;
  state.currentDrawerId = activePool[drawerIndex] ?? null;

  const wordPool = getWordPoolWithCustomPriority(
    state.config.customWordList,
    state.usedWords,
    state.config.customWordsOnly ?? false,
  );
  state.wordChoices = pickRandomWords(wordPool, GAME_CONSTANTS.WORD_CHOICES_COUNT);

  io.to(roomCode).emit(ServerEvents.ROUND_STARTING, {
    round: state.currentRound,
    totalRounds: state.config.roundCount,
    drawerId: state.currentDrawerId,
    roundId: state.roundId,
  });

  // Send word choices exclusively to the drawer's socket.
  // If the drawer is disconnected, we emit nothing here — the AFK timer below
  // will auto-select a word after WORD_SELECTION_TIMEOUT_SECONDS, so the game
  // continues without any special handling needed.
  if (state.currentDrawerId) {
    const drawerSocket = getSocketByUserId(io, state.currentDrawerId, roomCode);
    if (drawerSocket) {
      drawerSocket.emit(ServerEvents.WORD_CHOICES, { words: state.wordChoices });
    }
  }

  //CRITICAL: Always clear existing timers before starting a new one
  state.wordSelectionTimer = clearTimer(state.wordSelectionTimer);

  //Auto select a word with help of pickRandomItem if the drawer is AFK and doesn't pick one
  state.wordSelectionTimer = setTimeout(() => {
    const currentState = room.getState();

    //GUARD: If the round has moved on, abort execution
    if (currentState.roundId !== currentRoundId) return;

    if (!currentState.currentWord && currentState.wordChoices) {
      const randomWord = pickRandomItem(currentState.wordChoices);
      if (randomWord) {
        selectWord(io, roomCode, randomWord);
      } else {
        //This should never happen since wordChoices should always have 3 words, but just in case...
        endRound(io, roomCode, 'no_word_selected');
      }
    }
  }, GAME_CONSTANTS.WORD_SELECTION_TIMEOUT_SECONDS * 1000);
};

/**
 * This function handles the logic for when a drawer selects a word. It validates the selection, updates
 * the game state, and emits the necessary events to clients to transition into the drawing phase.
 * It also sets up timers for hint generation and the drawing phase, ensuring that the game
 * flow continues smoothly and that clients receive timely updates.
 * @param io The Socket.IO server instance
 * @param roomCode The unique code identifying the game room
 * @param word The word selected by the drawer for the current round
 */
export const selectWord = (io: Server, roomCode: string, word: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
  //Guard
  if (state.gameState !== GameState.ROUND_STARTING) return; //Can only select a word during the ROUND_STARTING phase
  if (!state.wordChoices?.includes(word)) return; //Invalid word choice

  const currentRoundId = state.roundId; //capture the current round ID for timer callbacks

  //Cancel the AFK timer since the drawer has made a selection
  state.wordSelectionTimer = clearTimer(state.wordSelectionTimer);

  state.currentWord = word;

  //ADD TO HISTORY
  state.usedWords.push(word);
  if (state.usedWords.length > GAME_CONSTANTS.MAX_RECENT_WORDS) {
    //Maintain a rolling history of recently used words to prevent repeats
    //Remove oldest word if we hit the cap
    state.usedWords.shift();
  }
  state.roundStartTime = Date.now(); // this is now not being used for the countdown we are using a synced hook (can be deleted but I kept it for now in case we want to use it for something else later)

  //Initialize hints for this round
  state.revealedHintIndexes.clear();
  state.currentHint = generateHint(word, state.revealedHintIndexes);

  room.transitionState(GameState.DRAWING);

  io.to(roomCode).emit(ServerEvents.ROUND_STARTED, {
    drawerId: state.currentDrawerId,
    wordLength: word.length,
    wordHint: state.currentHint, //Emit the generated hint string to the clients
    roundStartTime: state.roundStartTime, //this is now not being used for the countdown we are using a synced hook
  });

  //Start PERIODIC HINT TIMER to reveal new hints at regular intervals during the drawing phase
  state.hintTimer = setInterval(() => {
    const latestState = room.getState();

    //GUARD: Abort and clear if round has changed or word is missing
    if (latestState.roundId !== currentRoundId || !latestState.currentWord) {
      latestState.hintTimer = clearIntervalTimer(latestState.hintTimer);
      return;
    }

    // Get the dynamic cap based on the room's difficulty
    const hintCap =
      GAME_CONSTANTS.DIFFICULTY_HINT_CAPS[latestState.config.difficulty] ??
      GAME_CONSTANTS.DIFFICULTY_HINT_CAPS.medium;

    const randomHiddenIndex = getRandomHiddenIndex(
      latestState.currentWord,
      latestState.revealedHintIndexes,
      hintCap,
    );

    //If null we hit our reveal cap. Stop the timer and exit
    if (randomHiddenIndex === null) {
      latestState.hintTimer = clearIntervalTimer(latestState.hintTimer);
      return;
    }

    //Reveal the new hint index and regenerate the hint string
    latestState.revealedHintIndexes.add(randomHiddenIndex);
    latestState.currentHint = generateHint(
      latestState.currentWord,
      latestState.revealedHintIndexes,
    );

    //Emit the updated hint to all clients in the room
    io.to(roomCode).emit(ServerEvents.WORD_HINT_UPDATED, {
      hint: latestState.currentHint,
    });
  }, GAME_CONSTANTS.HINT_INTERVAL_SECONDS * 1000);

  //Server-enforced round timer (The actual drawing phase)
  state.drawingTimer = setTimeout(() => {
    const latestState = room.getState();

    //GUARD: Abort if this timer callback is stale (i.e. round has already ended or moved on)
    if (latestState.roundId !== currentRoundId) return;

    endRound(io, roomCode, 'timer_expired');
  }, state.config.drawTimeSeconds * 1000);
};

/**
 * Ends the current round and transitions the game state accordingly. It emits the round end
 * event to clients with the correct word, reason for round end, and updated scores.
 * @param io The Socket.IO server instance
 * @param roomCode The unique code identifying the game room
 * @param reason The reason for ending the round
 */
export const endRound = (io: Server, roomCode: string, reason: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
  if (state.gameState === GameState.ROUND_END) return; //Guard against multiple round end calls

  const currentRoundId = state.roundId; // SNAPSHOT

  const isLastRound = state.currentRound >= state.config.roundCount;

  // FULL LIFECYCLE CLEANUP: Kill all active phase timers
  state.wordSelectionTimer = clearTimer(state.wordSelectionTimer);
  state.drawingTimer = clearTimer(state.drawingTimer);
  state.hintTimer = clearIntervalTimer(state.hintTimer);
  state.intermissionTimer = clearTimer(state.intermissionTimer);

  // ==========================================
  // REDIS CLEANUP: Wipe the canvas history so the Time Machine
  // doesn't serve overlapping drawings for the next round.
  // ==========================================
  redis
    .del(`room:${roomCode}:canvas`)
    .catch((err) => console.error(`[Redis] Failed to clear canvas for room ${roomCode}:`, err));

  room.transitionState(GameState.ROUND_END);

  // Emit round end event with correct word, reason, and updated scores
  io.to(roomCode).emit(ServerEvents.ROUND_END, {
    correctWord: state.currentWord,
    reason,
    scores: [...state.players.values()].map((p) => ({
      id: p.id,
      username: p.username,
      score: p.score,
    })),
    isFinalRound: isLastRound,
  });

  state.currentWord = null;

  //Display scores briefly before starting the next round or ending the game
  //Set the intermission timer
  state.intermissionTimer = setTimeout(() => {
    const latestState = room.getState();

    // GUARD: Abort if this timer leaked
    if (latestState.roundId !== currentRoundId) return;

    if (latestState.currentRound >= latestState.config.roundCount) {
      endGame(io, roomCode); //end the game if we've reached the configured number of rounds
    } else {
      startNextRound(io, roomCode); //otherwise start the next round
    }
  }, GAME_CONSTANTS.ROUND_END_DISPLAY_SECONDS * 1000);
};

/**
 * Ends the game and transitions the game state accordingly. It
 * emits the game end event to clients with the final standings.
 * @param io The Socket.IO server instance
 * @param roomCode The unique code identifying the game room
 */
export const endGame = (io: Server, roomCode: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();

  if (state.gameState === GameState.GAME_END) return; //Guard against multiple game end calls

  // FULL LIFECYCLE CLEANUP: Kill all active timers to prevent any future callbacks from
  // executing after the game has ended intentionally or abruptly due to disconnections
  state.wordSelectionTimer = clearTimer(state.wordSelectionTimer);
  state.drawingTimer = clearTimer(state.drawingTimer);
  state.hintTimer = clearIntervalTimer(state.hintTimer);
  state.intermissionTimer = clearTimer(state.intermissionTimer);

  // ==========================================
  // REDIS CLEANUP: Destroy the canvas history to free server RAM immediately
  // ==========================================
  redis
    .del(`room:${roomCode}:canvas`)
    .catch((err) =>
      console.error(`[Redis] Failed to clear canvas for ended room ${roomCode}:`, err),
    );

  room.transitionState(GameState.GAME_END);

  const standings = [...state.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  // Emit game end event with final standings
  io.to(roomCode).emit(ServerEvents.GAME_END, { standings });
};

/**
 * Emergency abort — halts the game loop immediately when the room drops
 * below MIN_PLAYERS during live gameplay. Unlike endGame(), this does NOT
 * emit GAME_END (no podium). It emits GAME_ABORTED so the frontend can
 * show the "last player standing" lock-screen.
 * @param io The Socket.IO server instance
 * @param roomCode The unique code identifying the game room
 */
export const abortGame = (io: Server, roomCode: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();

  // Guard: only abort from active gameplay states
  if (state.gameState === GameState.LOBBY || state.gameState === GameState.GAME_END) return;

  // Kill ALL timers
  state.wordSelectionTimer = clearTimer(state.wordSelectionTimer);
  state.drawingTimer = clearTimer(state.drawingTimer);
  state.hintTimer = clearIntervalTimer(state.hintTimer);
  state.intermissionTimer = clearTimer(state.intermissionTimer);

  // Redis cleanup
  redis
    .del(`room:${roomCode}:canvas`)
    .catch((err) =>
      console.error(`[Redis] Failed to clear canvas for aborted room ${roomCode}:`, err),
    );

  // Transition to GAME_END internally
  room.transitionState(GameState.GAME_END);

  // Emit the ABORT signal
  io.to(roomCode).emit(ServerEvents.GAME_ABORTED, {
    reason: 'insufficient_players',
  });

  console.log(`[FSM] Game ABORTED in room ${roomCode} — insufficient players`);
};
