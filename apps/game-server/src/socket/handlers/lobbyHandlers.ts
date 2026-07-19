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
import { ServerEvents, ClientEvents, GameState, Player, ErrorCode } from '@scribblitz/types';
import {
  createRoomSchema,
  joinRoomSchema,
  roomConfigSchema,
  generateThemeSchema,
} from '@scribblitz/validation';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { roomManager } from '../../rooms/RoomManager';
import { ServerRoomState } from '../../rooms/Room';
import { emitError } from '../../utils/emitError';
import { serializeRoom } from '../utils/serializeRoom';
import { sanitizeConfig } from '../utils/sanitizeConfig';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import { endRound, abortGame } from '../../fsm/roundManager';
import logger from '../../utils/logger';
import { aiThemeQueue, aiThemeQueueEvents } from '../../services/aiQueue';
import {
  getLastThemeRequest,
  setThemeRequest,
  addActiveGeneration,
  removeActiveGeneration,
} from '../../rateLimiters/themeRateLimiter';

/**
 * Handles the creation of a new game room. Validates input,
 * updates server state, and communicates results back to the client.
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
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
      ErrorCode.ALREADY_IN_ROOM,
      'You cannot create a new room while currently being in one',
    );
    return;
  }

  //Payload validation
  const result = createRoomSchema.safeParse(rawPayload);

  if (!result.success) {
    emitError(
      socket,
      ErrorCode.BAD_REQUEST,
      result.error.issues[0]?.message || 'Invalid room creation data',
    );
    return;
  }

  const payload = result.data;

  const userId = getUserIdBySocket(socket);

  if (!userId) {
    emitError(socket, ErrorCode.UNAUTHORIZED, 'User not authenticated');
    return;
  }

  const player: Player = {
    id: userId,
    username: payload.username,
    avatarSeed: payload.avatarSeed,
    score: 0,
    isConnected: true,
    hasGuessedCorrectly: false,
  };

  //Server state mutation
  const roomState: ServerRoomState = roomManager.createRoom(userId, payload.config || {});
  roomManager.addPlayer(roomState.roomCode, player);

  //logging for debugging and analytics
  logger.info({ username: payload.username, roomCode: roomState.roomCode }, 'User created room');

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
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
 * @returns A function that takes the raw payload from the client and processes the room joining logic.
 * The function performs strict validation on the payload, checks user
 * authentication, interacts with the RoomManager to add the player to the room, and emits appropriate success
 * or error events back to the client.
 */
export const handleJoinRoom = (io: Server, socket: Socket) => (rawPayload: unknown) => {
  //validate
  const result = joinRoomSchema.safeParse(rawPayload);

  if (!result.success) {
    emitError(
      socket,
      ErrorCode.BAD_REQUEST,
      result.error.issues[0]?.message || 'Invalid join data',
    );
    return;
  }

  const payload = result.data;
  const roomCode = payload.roomCode.toUpperCase();
  const room = roomManager.getRoom(roomCode);

  //Business logic checks
  if (!room) {
    emitError(socket, ErrorCode.NOT_FOUND, 'Room not found');
    return;
  }

  //Only allow joining if game hasn't started yet
  if (room.getState().gameState !== GameState.LOBBY) {
    emitError(socket, ErrorCode.INVALID_STATE, 'Game already in progress');
    return;
  }

  const userId = getUserIdBySocket(socket);

  if (!userId) {
    emitError(socket, ErrorCode.UNAUTHORIZED, 'User not authenticated');
    return;
  }
  const player: Player = {
    id: userId,
    username: payload.username,
    score: 0,
    isConnected: true,
    hasGuessedCorrectly: false,
    avatarSeed: payload.avatarSeed,
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
  //but sanitized config (no raw word list if custom words are used)
  socket.emit(ServerEvents.ROOM_JOINED, {
    room: { ...serializedRoom, config: sanitizeConfig(serializedRoom.config) },
  });

  //Tell every other player in room that a player joined
  socket.to(roomCode).emit(ServerEvents.PLAYER_JOINED, { player });
};

/**
 * Handles the host updating the room configuration while in the lobby.
 * Validates the payload, ensures the sender is the host, and broadcasts
 * the updated config to all players in the room.
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
 */
export const handleUpdateConfig = (io: Server, socket: Socket) => (rawPayload: unknown) => {
  //validate
  const result = roomConfigSchema.safeParse(rawPayload);

  if (!result.success) {
    emitError(
      socket,
      ErrorCode.BAD_REQUEST,
      result.error.issues[0]?.message || 'Invalid config data',
    );
    return;
  }

  const roomCode = socket.data.roomCode;
  if (!roomCode) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    emitError(socket, ErrorCode.NOT_FOUND, 'Room not found');
    return;
  }

  const state = room.getState();

  //Business Logic: Ensure we are still in the Lobby
  if (state.gameState !== GameState.LOBBY) {
    emitError(socket, ErrorCode.INVALID_STATE, 'Cannot change settings after the game has started');
    return;
  }

  //Security: Ensure the sender is actually the Host
  const userId = getUserIdBySocket(socket);
  if (state.hostId !== userId) {
    emitError(socket, ErrorCode.UNAUTHORIZED, 'Only the host can update room settings');
    return;
  }

  //Server State Mutation
  room.updateConfig(result.data);

  const { customWordList, ...loggableConfig } = result.data; //Don't log the raw word list for security reasons and disk space

  logger.info(
    {
      roomCode,
      config: {
        ...loggableConfig,
        ...(customWordList !== undefined && { customWordCount: customWordList.length }),
      },
    },
    'Host updated room config',
  );

  //Client Communication: Broadcast the new config so host and all other players can update their UI.
  //The host gets the full config (including raw custom word list if applicable), while everyone else
  //gets a sanitized version.
  const updatedConfig = room.getState().config;
  socket.emit(ServerEvents.ROOM_CONFIG_UPDATED, { config: updatedConfig });
  socket.broadcast.to(roomCode).emit(ServerEvents.ROOM_CONFIG_UPDATED, {
    config: sanitizeConfig(updatedConfig),
  });
};

/**
 * Handles a player voluntarily leaving the room.
 * Safely removes them, reassigns the host if necessary, ends the round if drawer left, and notifies the room.
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
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

  // IMMEDIATELY leave the Socket.IO room so this client never receives
  // round:end / game:aborted / player:left events that are meant for remaining players
  socket.leave(roomCode);
  socket.data.roomCode = undefined; //Free the socket

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

  // We MUST END the round BEFORE removing the player from the roomManager.
  // If we remove them first, their score completely vanishes from the end-of-round podium screen
  // If the game is active and the player leaving is the drawer, end the round immediately (cumulative check above).
  // The leaving player's socket has already left the room, so they won't receive this.
  if (wasDrawerInActiveGame) {
    logger.info({ userId, roomCode }, 'Active drawer left room — aborting turn');
    void endRound(io, roomCode, 'drawer-left');
  }

  //Now safely remove the player from the server memory.
  const removeResult = roomManager.removePlayer(roomCode, userId);

  logger.info({ userId, roomCode }, 'User voluntarily left room');

  //If the room was destroyed do nothing else or else we execute below if

  if (removeResult && !removeResult.isEmpty) {
    //tell the frontend to remove the player from the UI
    io.to(roomCode).emit(ServerEvents.PLAYER_LEFT, {
      playerId: userId,
      permanent: true,
    });

    //Broadcast the host reassignment (handled by removePlayer) cleanly without violently refreshing the whole UI
    if (removeResult.wasHost && removeResult.newHostId) {
      logger.info({ roomCode, newHostId: removeResult.newHostId }, 'Host left — new host assigned');
      io.to(roomCode).emit(ServerEvents.HOST_CHANGED, { newHostId: removeResult.newHostId });
    }

    // LAST PLAYER STANDING CHECK (Voluntary Quit)
    // After removal, if the game was active and we're below MIN_PLAYERS, abort immediately.
    const connectedPlayers = Array.from(state.players.values()).filter((p) => p.isConnected);
    if (connectedPlayers.length < GAME_CONSTANTS.MIN_PLAYERS && isGameActive) {
      void abortGame(io, roomCode);
    }
  }
};

/**
 * Handles the generation of a new theme for the room.
 * @param io The Socket.IO server instance
 * @param socket The Socket.IO socket instance for the connected client
 * @returns A function that processes a request to generate a new theme. It validates the user's session,
 * checks rate limits, dispatches an AI generation job, and updates the room configuration with the new theme.
 * The function also handles success and error cases, emitting appropriate events back to the client.
 * It ensures that only the host can generate a theme and that the game is still in the lobby state.
 * The function also manages active generation locks to prevent concurrent requests and ensures that
 * the host does not start the game before the AI theme generation is complete.
 */
export const handleGenerateTheme = (io: Server, socket: Socket) => async (rawPayload: unknown) => {
  const roomCode = socket.data.roomCode;
  const userId = getUserIdBySocket(socket);

  if (!roomCode || !userId) return;

  const room = roomManager.getRoom(roomCode);
  if (!room) {
    emitError(socket, ErrorCode.NOT_FOUND, 'Room not found');
    return;
  }

  const state = room.getState();

  //Security & State Check
  if (state.gameState !== GameState.LOBBY) {
    emitError(socket, ErrorCode.INVALID_STATE, 'Cannot generate theme after the game has started');
    return;
  }
  if (state.hostId !== userId) {
    emitError(socket, ErrorCode.UNAUTHORIZED, 'Only the host can generate a theme');
    return;
  }

  //Rate Limiting Check
  const now = Date.now();
  const lastRequest = getLastThemeRequest(roomCode);
  if (now - lastRequest < GAME_CONSTANTS.AI_THEME_RATE_LIMIT_MS) {
    const remainingSecs = Math.ceil(
      (GAME_CONSTANTS.AI_THEME_RATE_LIMIT_MS - (now - lastRequest)) / 1000,
    );
    emitError(
      socket,
      ErrorCode.RATE_LIMITED,
      `Please wait ${remainingSecs} before generating again.`,
    );
    return;
  }

  //Payload validation
  const result = generateThemeSchema.safeParse(rawPayload);
  if (!result.success) {
    emitError(
      socket,
      ErrorCode.BAD_REQUEST,
      result.error.issues[0]?.message || 'Invalid theme data',
    );
    return;
  }

  const { theme } = result.data;

  //Lock in the rate limit now that the request is valid
  setThemeRequest(roomCode, now);

  try {
    //Mark this room as having an active AI generation job
    addActiveGeneration(roomCode);

    logger.info({ roomCode, theme }, 'Dispatching AI theme generation Job');

    //Dispatch the job to BullMQ
    const job = await aiThemeQueue.add(
      'generate',
      { theme },
      {
        removeOnComplete: true, //Don't clog up
        removeOnFail: true,
      },
    );

    //Wait for the worker to finish, WITH a strict AI_GENERATION_TIMEOUT_MS timeout
    //we race the worker's promise against a timeout promise to ensure we don't wait indefinitely
    const customWords = (await Promise.race([
      //if the worker takes too long, we will reject the promise and catch it below
      job.waitUntilFinished(aiThemeQueueEvents), //our worker will resolve this promise when the job is done
      new Promise(
        (
          _,
          reject, //timeout guard as a promise
        ) =>
          setTimeout(
            () => reject(new Error('Job timeout')),
            GAME_CONSTANTS.AI_GENERATION_TIMEOUT_MS,
          ),
      ),
    ])) as string[];

    // Mutate the Server State (apply the words and force Strict mode)
    room.updateConfig({
      customWordList: customWords,
      customWordsOnly: true,
    });

    logger.info(
      { roomCode, wordCount: customWords.length },
      'AI theme generation successful — updated room config',
    );

    //Client communication
    //Broadcast the new config to all players. The host gets the full config (including raw custom word
    //list if applicable), while everyone else gets a sanitized version.
    const updatedConfig = room.getState().config;
    socket.emit(ServerEvents.ROOM_CONFIG_UPDATED, { config: updatedConfig });
    socket.broadcast.to(roomCode).emit(ServerEvents.ROOM_CONFIG_UPDATED, {
      config: sanitizeConfig(updatedConfig),
    });

    //Notify the host that the theme generation was successful
    socket.emit(ServerEvents.THEME_GENERATED_SUCCESS);
  } catch (error) {
    logger.error({ roomCode, err: error }, 'AI theme generation failed or timed out');
    emitError(
      socket,
      ErrorCode.THEME_GENERATION_FAILED,
      'AI generation timed out or failed. Please try again or use default words.',
    );
  } finally {
    //Remove the room from the active generation set regardless of success or failure
    removeActiveGeneration(roomCode);
  }
};
