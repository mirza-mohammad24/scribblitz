/**
 * This module manages the game rounds, including starting the game, handling word selection,
 * managing timers for each phase of the round, and ending rounds and the game.
 * It interacts with the RoomManager to access and update the game state, and uses Socket.IO to
 * emit events to clients about state changes and round updates.
 */
import { ServerEvents, GameState } from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { roomManager } from '../rooms/RoomManager';
import { getWordPool, pickRandomWords, getAvailableWordPool } from '../words/wordPool';
import { Server } from 'socket.io';
import { clearTimer, clearIntervalTimer } from '../utils/timerCleanUp';
import { generateHint, getRandomHiddenIndex } from '../utils/hintUtils';

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
 * @param io
 * @param roomCode
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
 * @param io
 * @param roomCode
 */
export const startNextRound = (io: Server, roomCode: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();

  state.roundId++;
  const currentRoundId = state.roundId; //capture the current round ID for timer callbacks

  state.currentRound++;
  state.correctGuessers.clear();
  state.roundWinner = null;

  //Select the next drawer (simple round-robin based on map insertion order)
  const playerIds = [...state.players.keys()];
  const drawerIndex = (state.currentRound - 1) % playerIds.length;
  state.currentDrawerId = playerIds[drawerIndex] ?? null;

  const fullWordPool = state.config.customWordList || getWordPool();
  const availableWordPool = getAvailableWordPool(fullWordPool, state.usedWords);
  state.wordChoices = pickRandomWords(availableWordPool, GAME_CONSTANTS.WORD_CHOICES_COUNT);

  io.to(roomCode).emit(ServerEvents.ROUND_STARTING, {
    round: state.currentRound,
    totalRounds: state.config.roundCount,
    drawerId: state.currentDrawerId,
  });

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
 * @param io
 * @param roomCode
 * @param word
 */
export const selectWord = (io: Server, roomCode: string, word: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
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
  state.roundStartTime = Date.now();

  //Initialize hints for this round
  state.revealedHintIndexes.clear();
  state.currentHint = generateHint(word, state.revealedHintIndexes);

  room.transitionState(GameState.DRAWING);

  io.to(roomCode).emit(ServerEvents.ROUND_STARTED, {
    drawerId: state.currentDrawerId,
    wordLength: word.length,
    wordHint: state.currentHint, //Emit the generated hint string to the clients
  });

  //Start PERIODIC HINT TIMER to reveal new hints at regular intervals during the drawing phase
  state.hintTimer = setInterval(() => {
    const latestState = room.getState();

    //GUARD: Abort and clear if round has changed or word is missing
    if (latestState.roundId !== currentRoundId || !latestState.currentWord) {
      latestState.hintTimer = clearIntervalTimer(latestState.hintTimer);
      return;
    }

    const randomHiddenIndex = getRandomHiddenIndex(
      latestState.currentWord,
      latestState.revealedHintIndexes,
    );

    //If null we hit our 60% reveal cap. Stop the timer and exit
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
 * @param io
 * @param roomCode
 * @param reason
 */
export const endRound = (io: Server, roomCode: string, reason: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
  if (state.gameState === GameState.ROUND_END) return; //Guard against multiple round end calls

  const currentRoundId = state.roundId; // SNAPSHOT

  // FULL LIFECYCLE CLEANUP: Kill all active phase timers
  state.wordSelectionTimer = clearTimer(state.wordSelectionTimer);
  state.drawingTimer = clearTimer(state.drawingTimer);
  state.hintTimer = clearIntervalTimer(state.hintTimer);

  room.transitionState(GameState.ROUND_END);

  io.to(roomCode).emit(ServerEvents.ROUND_END, {
    correctWord: state.currentWord,
    reason,
    scores: [...state.players.values()].map((p) => ({
      id: p.id,
      username: p.username,
      score: p.score,
    })),
  });

  state.currentWord = null;

  //Display scores briefly before starting the next round or ending the game
  // Set the intermission timer
  state.intermissionTimer = setTimeout(() => {
    const latestState = room.getState();

    // GUARD: Abort if this timer leaked
    if (latestState.roundId !== currentRoundId) return;

    if (state.currentRound >= state.config.roundCount) {
      endGame(io, roomCode);
    } else {
      startNextRound(io, roomCode);
    }
  }, GAME_CONSTANTS.ROUND_END_DISPLAY_SECONDS * 1000);
};

/**
 * Ends the game and transitions the game state accordingly. It
 * emits the game end event to clients with the final standings.
 * @param io
 * @param roomCode
 */
export const endGame = (io: Server, roomCode: string): void => {
  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();

  // FULL LIFECYCLE CLEANUP: Kill all active timers to prevent any future callbacks from
  // executing after the game has ended intentionally or abruptly due to disconnections
  if (state.wordSelectionTimer) {
    state.wordSelectionTimer = clearTimer(state.wordSelectionTimer);
  }
  if (state.drawingTimer) {
    state.drawingTimer = clearTimer(state.drawingTimer);
  }
  if (state.hintTimer) {
    state.hintTimer = clearIntervalTimer(state.hintTimer);
  }
  if (state.intermissionTimer) {
    state.intermissionTimer = clearTimer(state.intermissionTimer);
  }

  room.transitionState(GameState.GAME_END);

  const standings = [...state.players.values()]
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));

  io.to(roomCode).emit(ServerEvents.GAME_END, { standings });
};
