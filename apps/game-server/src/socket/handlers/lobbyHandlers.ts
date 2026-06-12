/**
 * This module contains the socket event handlers related to lobby management,
 * including creating rooms, joining rooms, updating room configuration, and leaving rooms.
 * Each handler performs strict validation on incoming data, checks user permissions,
 * interacts with the RoomManager to update server state, and emits appropriate success or error events
 * back to the client. The handlers also include security guards to prevent unauthorized actions and
 * ensure the integrity of the game flow, such as preventing non-hosts from updating room settings
 * and handling edge cases when players leave during an active game. This module serves as the primary
 * interface for managing the lobby state of the game through Socket.io events.
 */

import { Server, Socket } from 'socket.io';
import { ServerEvents, GameState, Player } from '@scribblitz/types';
import { createRoomSchema, joinRoomSchema, roomConfigSchema } from '@scribblitz/validation';
import { roomManager } from '../../rooms/RoomManager';
import { ServerRoomState } from '../../rooms/Room';
import { emitError } from '../../utils/emitError';
import { serializeRoom } from '../utils/serializeRoom';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import { endRound } from '../../fsm/roundManager';

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
  /**
   * SECURITY: Reconnect Console Exploit Guard
   * * This check acts as a "Bouncer" for the socket's local memory.
   * If a player's Wi-Fi blips and they auto-reconnect, the server brilliantly
   * restores their session and assigns `socket.data.roomCode`. However, the
   * connection logic "falls through" and re-registers the ROOM_CREATE listener.
   * * Without this guard, a malicious user sitting in the drawing phase could open
   * browser DevTools and manually fire `socket.emit('room:create')`. The server
   * would process it, binding a single socket to TWO different rooms simultaneously.
   * This would corrupt the server's routing (e.g., drawing lines to the wrong room)
   * and crash the game. This check guarantees an active socket cannot spin up new rooms.
   *
   * NOTE: This is different from the "already in room" check below in the handleJoinRoom function.
   * That one is purely for user experience (e.g joining a room in which you are already a member) and
   * does not have security implications, while this one is a hard security guard against a specific
   * exploit that can crash the server. Both are necessary.
   *
   * Moreover: This does not prevent a user from opening two tabs and creating two rooms, because
   * each tab has a separate socket connection. However, this is not a problem because each room
   * is independent and the user can only be in one room per socket connection. The guard is
   * specifically designed to prevent the scenario where a single socket connection is associated
   * with multiple rooms, which can lead to server instability.
   */
  if (socket.data.roomCode) {
    emitError(
      socket,
      'ALREADY_IN_ROOM',
      'You cannot create a new room while currently being in one',
    );
    return;
  }

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
  console.log(
    `[Lobby] User ${payload.username} created room: ${roomState.roomCode} (from file lobbyHandlers.ts)`,
  );

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

/**
 * Handles the host updating the room configuration while in the lobby.
 * Validates the payload, ensures the sender is the host, and broadcasts
 * the updated config to all players in the room.
 * @param io
 * @param socket
 */
export const handleUpdateConfig = (io: Server, socket: Socket) => (rawPayload: unknown) => {
  //validate
  const result = roomConfigSchema.safeParse(rawPayload);

  if (!result.success) {
    emitError(socket, 'BAD_REQUEST', result.error.issues[0]?.message || 'Invalid config data');
    return;
  }

  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    emitError(socket, 'NOT_FOUND', 'Room not found');
    return;
  }

  const state = room.getState();

  //Business Logic: Ensure we are still in the Lobby
  if (state.gameState !== GameState.LOBBY) {
    emitError(socket, 'INVALID_STATE', 'Cannot change settings after the game has started');
    return;
  }

  //Security: Ensure the sender is actually the Host
  const userId = getUserIdBySocket(socket);
  if (state.hostId !== userId) {
    emitError(socket, 'UNAUTHORIZED', 'Only the host can update room settings');
    return;
  }

  //Server State Mutation
  room.updateConfig(result.data);

  //Logging for debug
  console.log(
    `[Lobby] Host updated config for room ${roomCode}: (from file lobbyHandlers.ts)`,
    result.data,
  );

  //Client Communication: Broadcast the new config so all UI sliders snap to the new values
  io.to(roomCode).emit(ServerEvents.ROOM_CONFIG_UPDATED, { config: room.getState().config });
};

/**
 * Handles a player voluntarily leaving the room.
 * Safely removes them, reassigns the host if necessary, ends the round if drawer left, and notifies the room.
 * @param io
 * @param socket
 * @returns A function that processes a player's request to leave the room. It validates the user's session,
 * updates the server state by removing the player from the room, handles host reassignment if the leaving player
 * is the host, and emits appropriate events to notify other players in the room about the departure and any host changes.
 */

export const handleLeaveRoom = (io: Server, socket: Socket) => () => {
  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);

  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) return;

  const state = room.getState();
  const isGameActive =
    state.gameState === GameState.DRAWING ||
    state.gameState === GameState.PARALLEL_DRAWING ||
    state.gameState === GameState.ROUND_STARTING ||
    state.gameState === GameState.ROUND_END;

  // cumulative check to see if the leaving player is the drawer in an active game,
  // which requires special handling to end the round immediately and prevent game freezes.
  // We check this before mutating server state to ensure we have the correct information about
  // the player's role in the current game state.
  const wasDrawerInActiveGame = state.currentDrawerId === userId && isGameActive;

  //Now safely remove the player from the server memory.
  const removeResult = roomManager.removePlayer(roomCode, userId);

  // If the game is active and the player leaving is the drawer, end the round immediately (cumulative check above)
  if (wasDrawerInActiveGame) {
    console.log(
      `[Game] Active drawer ${userId} left the room. Aborting turn. (from file lobbyHandlers.ts)`,
    );
    endRound(io, roomCode, 'drawer-left');
  }

  //Clean up
  socket.leave(roomCode);
  socket.data.roomCode = undefined; //Free the socket

  console.log(
    `[Lobby] User ${userId} voluntarily left room: ${roomCode} (from file lobbyHandlers.ts)`,
  );

  //If the room was destroyed do nothing else or else we execute below if

  if (removeResult && !removeResult.isEmpty) {
    //tell the frontend to remove the player from the UI
    io.to(roomCode).emit(ServerEvents.PLAYER_LEFT, {
      playerId: userId,
      permanent: true,
    });

    //Broadcast the host reassignment (handled by removePlayer) cleanly without violently refreshing the whole UI
    if (removeResult.wasHost && removeResult.newHostId) {
      console.log(
        `[Lobby] Host left. New host assigned for room ${roomCode} is ${removeResult.newHostId} (from file lobbyHandlers.ts)`,
      );
      io.to(roomCode).emit(ServerEvents.HOST_CHANGED, { newHostId: removeResult.newHostId });
    }
  }
};
