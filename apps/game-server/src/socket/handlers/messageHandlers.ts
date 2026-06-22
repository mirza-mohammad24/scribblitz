/**
 * This module handles incoming chat messages from clients during the game. It validates the message
 * payload, checks the game state, and determines whether the message is a normal chat message or a
 * guess attempt. If it's a guess attempt, it evaluates whether the guess is correct and updates
 * the game state accordingly, including scoring and broadcasting events to clients. The module also
 * includes guards to handle race conditions and ensure that messages from old rounds are not processed,
 * maintaining the integrity of the game flow.
 */

import { Server, Socket } from 'socket.io';
import { ServerEvents, GameState } from '@scribblitz/types';
import { chatMessageSchema } from '@scribblitz/validation';
import { GAME_CONSTANTS } from '@scribblitz/shared/dist/constants';
import { ServerRoomState } from '../../rooms/Room';
import { roomManager } from '../../rooms/RoomManager';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import { levenshteinDistance } from '../../utils/levenshtein';
import { endRound } from '../../fsm/roundManager';

/**
 * Checks if all non-drawer and connected players have guessed the word correctly.
 * @param roomState
 * @returns a boolean indicating whether all guessers have guessed correctly, which is
 * used to determine if the round should end early.
 */
const hasEveryoneGuessedCorrectly = (roomState: ServerRoomState): boolean => {
  const connectedGuessers = Array.from(roomState.players.values()).filter(
    (p) => p.id !== roomState.currentDrawerId && p.isConnected,
  );
  return (
    connectedGuessers.length > 0 &&
    connectedGuessers.every((p) => roomState.correctGuessers.has(p.id))
  );
};

/**
 * Handles incoming chat messages from clients. It validates the message, checks the game state,
 * and determines if it's a normal chat or a guess attempt.
 * If it's a guess attempt, it evaluates the guess, updates scores, and emits appropriate events to
 * clients. It also includes guards to prevent processing of messages from old rounds.
 * @param io
 * @param socket
 * @returns a function that processes incoming chat messages, including guess evaluation and game state updates.
 */
export const handleChatMessage = (io: Server, socket: Socket) => (payload: unknown) => {
  //Validation
  const result = chatMessageSchema.safeParse(payload);

  if (!result.success) {
    console.log(
      `[Chat] Invalid message payload from ${socket.id}: (from file messageHandlers.ts)`,
      result.error.errors,
    );
    return; //Silently drop invalid payloads
  }

  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
  const player = state.players.get(userId);

  if (!player) return;

  //RACE CONDITION GUARD: Drop delayed messages from old rounds
  if (result.data.roundId !== state.roundId) {
    console.log(
      `[Chat] Round Mismatch! Client sent: ${result.data.roundId}, Server expects: ${state.roundId} (from file messageHandlers.ts)`,
    );
    return;
  }

  const text = result.data.message.trim();
  const isDrawer = state.currentDrawerId === userId;
  const hasAlreadyGuessed = state.correctGuessers.has(userId);
  const isDrawingPhase =
    state.gameState === GameState.DRAWING || state.gameState === GameState.PARALLEL_DRAWING;

  //NORMAL CHAT LOGIC
  //due to placement of if conditions below everyone will be able to chat during the non drawing phase
  //but if this is not true then only players who are not the drawer or have not guessed correctly will
  // be able to chat during the drawing phase
  if (!isDrawingPhase) {
    //if we are in the lobby or Game End, everyone can chat freely
    io.to(roomCode).emit(ServerEvents.CHAT_BROADCAST, {
      senderId: userId,
      senderName: player.username,
      message: text,
      isSystem: false, //Clients can use this flag to style system messages differently if needed
    });
    return;
  }

  // GUARD: Muzzle the Drawer and Correct Guessers during the round
  if (isDrawer || hasAlreadyGuessed) {
    // Silently drop their chat message. They are not allowed to talk
    // to the rest of the room while a drawing is active.
    return;
  }

  //GUESS EVALUATION LOGIC
  const correctWordRaw = state.currentWord?.trim();

  if (!correctWordRaw) return;

  //NORMALIZATION (Strip spaces, lowercase)
  const correctWordNormalized = correctWordRaw.toLowerCase().replace(/\s+/g, '');
  const guessNormalized = text.toLowerCase().replace(/\s+/g, '');

  if (guessNormalized === correctWordNormalized) {
    //CORRECT GUESS
    state.correctGuessers.add(userId);
    player.hasGuessedCorrectly = true; // Keep Player object in sync with correctGuessers Set

    //Time-Decay Scoring Math (Early guesser gets more points)
    const timeElapsed = Date.now() - (state.roundStartTime || Date.now());
    const totalTime = state.config.drawTimeSeconds * 1000;
    // 1.0 is instant and 0.0 is the last second
    const timeRatio = Math.max(0, 1 - timeElapsed / totalTime);

    //Base 100 points + up to 400 speed bonus points
    const pointsEarned = Math.floor(100 + 400 * timeRatio);
    player.score += pointsEarned;

    //Drawer Points: The drawer gets 10% of the points the guesser earned
    if (state.currentDrawerId) {
      const drawer = state.players.get(state.currentDrawerId);
      if (drawer) {
        drawer.score += Math.floor(pointsEarned * 0.1);
      }
    }
    //Broadcast to the room that someone got it (Hides the word)
    io.to(roomCode).emit(ServerEvents.PLAYER_GUESSED, {
      playerId: userId,
      username: player.username,
    });

    //Send the actual word and the point ONLY to the user who guessed it
    socket.emit(ServerEvents.GUESS_CORRECT, {
      word: state.currentWord,
      pointsEarned,
    });

    //  Broadcast live scores to everyone for leaderboard updates.
    io.to(roomCode).emit(ServerEvents.SCORE_UPDATE, {
      scores: [...state.players.values()].map((p) => ({
        id: p.id,
        score: p.score,
      })),
    });

    //EARLY ROUND COMPLETION
    if (hasEveryoneGuessedCorrectly(state)) {
      endRound(io, roomCode, 'all_guessed');
    }
  } else {
    // INCORRECT GUESS
    // Broadcast the wrong guess normally so everyone can see it
    io.to(roomCode).emit(ServerEvents.CHAT_BROADCAST, {
      senderId: userId,
      senderName: player.username,
      message: text, // Send the original text to the chat
      isSystem: false,
    });

    // CLOSE GUESS CHECK (Private to guesser)
    // Running Levenshtein strictly on the normalized string
    const distance = levenshteinDistance(guessNormalized, correctWordNormalized);

    // Dynamic threshold: Distance 1 for short words (<=4) scaling up based on length.
    const base = GAME_CONSTANTS.LEVENSHTEIN_CLOSE_THRESHOLD; // Defaults to 2
    const threshold =
      correctWordNormalized.length <= 4
        ? 1
        : base + Math.floor(Math.max(0, correctWordNormalized.length - 5) / 5);

    // Trigger only if it's a valid edit distance
    if (distance > 0 && distance <= threshold) {
      socket.emit(ServerEvents.GUESS_CLOSE, {
        message: `'${text}' is very close!`, // Quote their raw text back to them
      });
    }
  }
};
