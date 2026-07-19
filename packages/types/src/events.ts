/**
 * This file defines the event types for client-server communication in the Scribblitz game.
 * It includes two main objects, ClientEvents and ServerEvents, which list all the possible
 * events that can be emitted by the client and server respectively.
 */

/**
 * ClientEvents object contains the event names that the client can emit to the server.
 */
export const ClientEvents = {
  ROOM_CREATE: 'room:create',
  ROOM_JOIN: 'room:join',
  ROOM_LEAVE: 'room:leave',
  GAME_START: 'game:start',
  WORD_SELECT: 'word:select',
  CANVAS_BATCH: 'canvas:batch',
  CANVAS_CLEAR: 'canvas:clear',
  CANVAS_UNDO: 'canvas:undo',
  CANVAS_SYNC_REQUEST: 'canvas:sync_request',
  CHAT_MESSAGE: 'chat:message',
  ROOM_UPDATE_CONFIG: 'room:update_config',
  RETURN_TO_LOBBY: 'game:return_to_lobby',
  EMOTE_SEND: 'emote:send',
  GENERATE_THEME: 'theme:generate',
} as const;

/**
 * ServerEvents object contains the event names that the server can emit to the client.
 */
export const ServerEvents = {
  ROOM_CREATED: 'room:created',
  ROOM_JOINED: 'room:joined',
  PLAYER_JOINED: 'player:joined',
  PLAYER_DISCONNECTED: 'player:disconnected', //for temporary disconnect (will be able to rejoin the same session 60 sec grace period)
  PLAYER_LEFT: 'player:left', //for permanent leave (can not rejoin the left session)
  GAME_STATE_CHANGED: 'game:state_changed',
  ROUND_STARTING: 'round:starting',
  WORD_CHOICES: 'word:choices',
  ROUND_STARTED: 'round:started',
  ROUND_END: 'round:end',
  GAME_END: 'game:end',
  CANVAS_BATCH: 'canvas:batch',
  CANVAS_REPLAY: 'canvas:replay',
  CANVAS_CLEARED: 'canvas:cleared',
  CANVAS_UNDONE: 'canvas:undone',
  CANVAS_HISTORY: 'canvas:history',
  CHAT_BROADCAST: 'chat:broadcast',
  GUESS_CORRECT: 'guess:correct',
  GUESS_CLOSE: 'guess:close',
  PLAYER_GUESSED: 'player:guessed',
  SCORE_UPDATE: 'score:update',
  EMOTE_BROADCAST: 'emote:broadcast',
  GLOW_UP_READY: 'glow_up:ready',
  ERROR: 'server:error',
  WORD_HINT_UPDATED: 'word:hint_updated',
  ROOM_CONFIG_UPDATED: 'room:config_updated',
  HOST_CHANGED: 'room:host_changed',
  LOBBY_RESET: 'room:lobby_reset',
  GAME_ABORTED: 'game:aborted',
  DRAWER_WORD_REVEAL: 'drawer:word_reveal',
  THEME_GENERATED_SUCCESS: 'theme:generated_success',
} as const;
