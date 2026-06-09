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
  CANVAS_SYNC_REQUEST: 'canvas:sync_request',
  CHAT_MESSAGE: 'chat:message',
  EMOTE_SEND: 'emote:send',
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
  CANVAS_HISTORY: 'canvas:history',
  CHAT_BROADCAST: 'chat:broadcast',
  GUESS_CORRECT: 'guess:correct',
  GUESS_CLOSE: 'guess:close',
  PLAYER_GUESSED: 'player:guessed',
  EMOTE_BROADCAST: 'emote:broadcast',
  GLOW_UP_READY: 'glow_up:ready',
  ERROR: 'server:error',
  WORD_HINT_UPDATED: 'word:hint_updated',
} as const;
