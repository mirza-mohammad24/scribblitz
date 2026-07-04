/**
 * This module contains the socket event handlers related to game actions, such as starting the game,
 * selecting a word, and returning to the lobby after a game ends. Each handler includes necessary
 * security guards to validate the user's permissions and the current game state before allowing the action
 * to proceed. The handlers interact with the RoomManager and FSM controllers to update the game state
 * and emit relevant events back to the clients, ensuring a secure and consistent game flow.
 */

import { Server, Socket } from 'socket.io';
import { roomManager } from '../../rooms/RoomManager';
import { startGame, selectWord } from '../../fsm/roundManager';
import { emitError } from '../../utils/emitError';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import { wordSelectSchema } from '@scribblitz/validation';
import { GameState, ServerEvents, ErrorCode } from '@scribblitz/types';
import { serializeRoom } from '../utils/serializeRoom';
import { GAME_CONSTANTS } from '@scribblitz/shared/dist/constants';

/**
 * Handles the game start event
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
 * @returns a function that processes the game start logic, including validating the user's permissions
 * and initiating the game loop through the FSM controller.
 */
export const handleGameStart = (io: Server, socket: Socket) => () => {
  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    emitError(socket, ErrorCode.NOT_FOUND, 'Room not found');
    return;
  }

  // SECURITY GUARD: Explicit FSM state guard.
  if (room.getState().gameState !== GameState.LOBBY) {
    emitError(socket, ErrorCode.INVALID_STATE, 'Game can only be started from the lobby');
    return;
  }

  //SECURITY GUARD: Only the host can start the game
  if (room.getState().hostId !== userId) {
    emitError(socket, ErrorCode.UNAUTHORIZED, 'Only the host can start the game');
    return;
  }

  //SECURITY GUARD: Enforce minimum player count before starting the game
  if (room.getState().players.size < GAME_CONSTANTS.MIN_PLAYERS) {
    emitError(
      socket,
      ErrorCode.NOT_ENOUGH_PLAYERS,
      `Need at least ${GAME_CONSTANTS.MIN_PLAYERS} players to start the game.`,
    );
    return;
  }

  //Start the game loop in the FSM controller (roundManager.ts)
  startGame(io, roomCode);
};

/**
 * Handles the word selection event
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
 * @returns a function that processes the word selection logic, including validating the user's permissions
 * and passing the selected word to the FSM controller.
 */
export const handleWordSelect = (io: Server, socket: Socket) => (payload: unknown) => {
  //Strict validation
  const result = wordSelectSchema.safeParse(payload);

  if (!result.success) {
    emitError(socket, ErrorCode.BAD_REQUEST, 'Invalid word selection data');
    return;
  }

  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  //SECURITY GUARD: Only the current drawer can select the word
  if (room.getState().currentDrawerId !== userId) {
    emitError(socket, ErrorCode.UNAUTHORIZED, 'Only the current drawer can pick a word');
    return;
  }

  //Pass it to the FSM controller
  selectWord(io, roomCode, result.data.word);
};

/**
 * Handles the return to lobby event after a game ends, allowing the host
 * to reset the game state and return everyone to the lobby view.
 * This includes a security guard to ensure only the host can trigger this
 * action and that it can only be done from the GAME_END state.
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
 * @returns A function that processes the return to lobby logic,
 * including validating the user's permissions, resetting the room state
 * for a new game, and emitting the updated lobby state to all clients in the room.
 */
export const handleReturnToLobby = (io: Server, socket: Socket) => () => {
  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  //SECURITY GUARD
  if (room.getState().gameState !== GameState.GAME_END) return;

  if (room.getState().hostId !== userId) {
    emitError(socket, ErrorCode.UNAUTHORIZED, 'Only the host can return to the lobby');
    return;
  }

  room.resetForNewGame();

  //Send the refreshed lobby state to everyone
  //We use LOBBY_RESET here because we actually want the UI to completely reset
  io.to(roomCode).emit(ServerEvents.LOBBY_RESET, { room: serializeRoom(room.getState()) });
};
