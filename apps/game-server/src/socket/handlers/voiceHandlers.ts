import { Server, Socket } from 'socket.io';
import { ClientEvents, ServerEvents, ErrorCode } from '@scribblitz/types';
import { roomManager } from '../../rooms/RoomManager';
import { getUserIdBySocket } from '../utils/getUserIdBySocket';
import { emitError } from '../../utils/emitError';
import { mintVoiceToken, getLivekitUrl } from '../../services/voiceService';
import logger from '../../utils/logger';

export const registerVoiceHandlers = (io: Server, socket: Socket) => {
  socket.on(ClientEvents.VOICE_TOKEN_REQUEST, async () => {
    const userId = getUserIdBySocket(socket);
    if (!userId) return;

    const room = roomManager.getRoomByUserId(userId);
    if (!room) {
      emitError(socket, ErrorCode.VOICE_CHAT_FAILED, 'You must be in a room to join voice chat.');
      return;
    }

    const roomCode = room.getRoomCode();
    const player = room.getState().players.get(userId);
    if (!player) {
      emitError(socket, ErrorCode.VOICE_CHAT_FAILED, 'Player record not found in room.');
      return;
    }

    const livekitUrl = getLivekitUrl();
    const token = await mintVoiceToken(userId, roomCode, player.username);

    if (!token || !livekitUrl) {
      logger.warn({ userId, roomCode }, 'Voice token request failed - voice chat not configured');
      emitError(
        socket,
        ErrorCode.VOICE_CHAT_FAILED,
        'Voice chat is not available on this server right now.',
      );
      return;
    }

    socket.emit(ServerEvents.VOICE_TOKEN_ISSUED, {
      token,
      livekitUrl,
      roomName: roomCode,
    });
  });
};
