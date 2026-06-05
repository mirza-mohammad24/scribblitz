/**
 * This file contains the Socket.io event handlers for lobby interactions.
 * * Flow:
 * 1. Receive raw payload from client (type: unknown).
 * 2. Validate payload strictly using Zod schema.
 * 3. Interact with the RoomManager to update server memory.
 * 4. Emit success/error events back to the client(s).
 */

import { Server, Socket } from 'socket.io';
import { ServerEvents, GameState, Player } from '@scribblitz/types';
import { createRoomSchema, joinRoomSchema } from '@scribblitz/validation';
import { roomManager } from '../../rooms/RoomManager';
import { ServerRoomState } from '../../rooms/Room';
import { emitError } from '../utils/emitError';
import { serializeRoom } from '../utils/serializeRoom';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';

/**
 * Handles the creation of a new game room. Validates input,
 * updates server state, and communicates results back to the client.
 * @param io
 * @param socket
 * @returns A function that takes the raw payload from the client and processes the room creation logic.
 * The function performs strict validation on the payload, checks user
 * authentication, interacts with the RoomManager to create a new room, and emits appropriate success
 * or error events back to the client.
 */
export const handleCreateRoom = (io: Server, socket: Socket) => (rawPayload: unknown) => {
  //Payload validation
  const result = createRoomSchema.safeParse(rawPayload);

  if (!result.success) {
    emitError(
      socket,
      'BAD_REQUEST',
      result.error.issues[0]?.message || 'Invalid room creation data',
    );
    return;
  }

  const payload = result.data;

  const userId = getUserIdBySocket(socket);

  if (!userId) {
    emitError(socket, 'UNAUTHORIZED', 'User not authenticated');
    return;
  }

  const player: Player = {
    id: userId,
    username: payload.username,
    score: 0,
    isConnected: true,
    hasGuessedCorrectly: false,
  };

  //Server state mutation
  const roomState: ServerRoomState = roomManager.createRoom(userId, payload.config || {});
  roomManager.addPlayer(roomState.roomCode, player);

  //logging for debugging and analytics
  console.log(`[Lobby] User ${payload.username} created room: ${roomState.roomCode}`);

  //Socket infra
  socket.join(roomState.roomCode);
  socket.data.roomCode = roomState.roomCode;

  //Client Communication (Feedback of valid creation)

  const serializedRoom = serializeRoom(roomState);

  socket.emit(ServerEvents.ROOM_CREATED, { room: serializedRoom });
};

/**
 * Handles the joining of a player to an existing game room. Validates input,
 * updates server state, and communicates results back to the client.
 * @param io
 * @param socket
 * @returns A function that takes the raw payload from the client and processes the room joining logic.
 * The function performs strict validation on the payload, checks user
 * authentication, interacts with the RoomManager to add the player to the room, and emits appropriate success
 * or error events back to the client.
 */
export const handleJoinRoom = (io: Server, socket: Socket) => (rawPayload: unknown) => {
  //validate
  const result = joinRoomSchema.safeParse(rawPayload);

  if (!result.success) {
    emitError(socket, 'BAD_REQUEST', result.error.issues[0]?.message || 'Invalid join data');
    return;
  }

  const payload = result.data;
  const roomCode = payload.roomCode.toUpperCase();
  const room = roomManager.getRoom(roomCode);

  //Business logic checks
  if (!room) {
    emitError(socket, 'NOT_FOUND', 'Room not found');
    return;
  }

  //Only allow joining if game hasn't started yet
  if (room.getState().gameState !== GameState.LOBBY) {
    emitError(socket, 'INVALID_STATE', 'Game already in progress');
    return;
  }

  const userId = getUserIdBySocket(socket);

  if (!userId) {
    emitError(socket, 'UNAUTHORIZED', 'User not authenticated');
    return;
  }
  const player: Player = {
    id: userId,
    username: payload.username,
    score: 0,
    isConnected: true,
    hasGuessedCorrectly: false,
  };

  //Server State Mutation
  const addResult = roomManager.addPlayer(roomCode, player);

  if (!addResult.success) {
    emitError(socket, addResult.reason, `Failed to join ${addResult.reason}`);
    return;
  }

  //Socket infra
  socket.join(roomCode);
  socket.data.roomCode = roomCode;

  //Feedback to client
  const serializedRoom = serializeRoom(room.getState());

  //Joining player informed that they got in and provide the full room state
  socket.emit(ServerEvents.ROOM_JOINED, { room: serializedRoom });

  //Tell every other player in room that a player joined
  socket.to(roomCode).emit(ServerEvents.PLAYER_JOINED, { player });
};
