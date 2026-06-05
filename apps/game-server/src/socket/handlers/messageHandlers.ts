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
import { ServerRoomState } from '../../rooms/Room';
import { roomManager } from '../../rooms/RoomManager';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import { endRound } from '../../fsm/roundManager';

/**
 * Checks if all non-drawer players have guessed the word correctly.
 * @param roomState
 * @returns a boolean indicating whether all guessers have guessed correctly, which is
 * used to determine if the round should end early.
 */
const hasEveryoneGuessedCorrectly = (roomState: ServerRoomState): boolean => {
  const totalGuessers = roomState.players.size - 1; //Exclude the drawer
  return totalGuessers > 0 && roomState.correctGuessers.size >= totalGuessers;
};

/**
 * Handles incoming chat messages from clients. It validates the message, checks the game state,
 * and determines if it's a normal chat or a guess attempt.
 * If it's a guess attempt, it evaluates the guess, updates scores, and emits appropriate events to
 * clients. It also includes guards to prevent processing of messages from old rounds.
 * @param io
 * @param socket
 * @returns
 */
export const handleChatMessage = (io: Server, socket: Socket) => (payload: unknown) => {
  const result = chatMessageSchema.safeParse(payload);
  if (!result.success) return; //Silently drop invalid payloads

  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
  const player = state.players.get(userId);

  if (!player) return;

  //RACE CONDITION GUARD: Drop delayed messages from old rounds
  if (result.data.roundId !== state.currentRound) return;

  const text = result.data.message.trim();
  const isDrawer = state.currentDrawerId === userId;
  const hasAlreadyGuessed = state.correctGuessers.has(userId);
  const isDrawingPhase = state.gameState === GameState.DRAWING;

  //NORMAL CHAT LOGIC
  //If this is not the drawing phase, or the user is the drawer, or they already guessed the word
  //We treat the message as a normal chat message and broadcast it to everyone without guess evaluation
  if (!isDrawingPhase || isDrawer || hasAlreadyGuessed) {
    io.to(roomCode).emit(ServerEvents.CHAT_BROADCAST, {
      senderId: userId,
      senderName: player.username,
      message: text,
      isSystem: false,
    });
    return;
  }

  //GUESS EVALUATION LOGIC
  const correctWord = state.currentWord?.toLowerCase().trim();
  const guess = text.toLowerCase();

  if (correctWord && guess === correctWord) {
    //CORRECT GUESS
    state.correctGuessers.add(userId);
    player.hasGuessedCorrectly = true; // Keep Player object in sync with correctGuessers Set

    //Time-Decay Scoring Math (Early guesser gets more time)
    const timeElapsed = Date.now() - (state.roundStartTime || Date.now());
    const totalTime = state.config.drawTimeSeconds * 1000;
    // 1.0 is instant and 0.0 is the last second
    const timeRatio = Math.max(0, 1 - timeElapsed / totalTime);

    //Base 100 points + up to 400 speed bonus points
    const pointsEarned = Math.floor(100 + 400 * timeRatio);
    player.score += pointsEarned;

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

    //EARLY ROUND COMPLETION
    if (hasEveryoneGuessedCorrectly(state)) {
      endRound(io, roomCode, 'all_guessed');
    }
  } else {
    //INCORRECT GUESS
    //Broadcast the wrong guess normally so everyone can see it
    io.to(roomCode).emit(ServerEvents.CHAT_BROADCAST, {
      senderId: userId,
      senderName: player.username,
      message: text,
      isSystem: false,
    });
  }
};
