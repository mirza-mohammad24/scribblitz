/**
 * This module contains the socket event handlers related to game actions, such as
 * starting the game and selecting a word. Each handler performs strict validation
 * on incoming data, checks user permissions, interacts with the RoomManager and
 * FSM controllers, and emits appropriate success or error events back to the client.
 */

import { Server, Socket } from 'socket.io';
import { roomManager } from '../../rooms/RoomManager';
import { startGame, selectWord } from '../../fsm/roundManager';
import { emitError } from '../utils/emitError';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import { wordSelectSchema } from '@scribblitz/validation';

/**
 * Handles the game start event
 * @param io
 * @param socket
 * @returns a function that processes the game start logic, including validating the user's permissions
 *  and initiating the game loop through the FSM controller.
 */
export const handleGameStart = (io: Server, socket: Socket) => () => {
  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    emitError(socket, 'NOT_FOUND', 'Room not found');
    return;
  }

  //SECURITY GUARD: Only the host can start the game
  if (room.getState().hostId !== userId) {
    emitError(socket, 'UNAUTHORIZED', 'Only the host can start the game');
    return;
  }

  //Start the game loop
  startGame(io, roomCode);
};

/**
 * Handles the word selection event
 * @param io
 * @param socket
 * @returns a function that processes the word selection logic, including validating the user's permissions
 *  and passing the selected word to the FSM controller.
 */
export const handleWordSelect = (io: Server, socket: Socket) => (payload: unknown) => {
  //Strict validation
  const result = wordSelectSchema.safeParse(payload);

  if (!result.success) {
    emitError(socket, 'BAD_REQUEST', 'Invalid word selection data');
    return;
  }

  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);
  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  //SECURITY GUARD: Only the current drawer can select the word
  if (room.getState().currentDrawerId !== userId) {
    emitError(socket, 'UNAUTHORIZED', 'Only the current drawer can pick a word');
    return;
  }

  //Pass it to the FSM controller
  selectWord(io, roomCode, result.data.word);
};
