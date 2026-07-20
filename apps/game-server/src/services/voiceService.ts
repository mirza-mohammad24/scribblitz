import { AccessToken } from 'livekit-server-sdk';
import logger from '../utils/logger';

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;
const LIVEKIT_URL = process.env.LIVEKIT_URL;

const isVoiceConfigured = Boolean(LIVEKIT_API_KEY && LIVEKIT_API_SECRET && LIVEKIT_URL);

if (!isVoiceConfigured) {
  logger.warn(
    'LIVEKIT_API_KEY / LIVEKIT_API_SECRET / LIVEKIT_URL not set - voice chat is disabled',
  );
}

const TOKEN_TTL_SECONDS = 10 * 60;

export async function mintVoiceToken(
  userId: string,
  roomCode: string,
  username: string,
): Promise<string | null> {
  if (!isVoiceConfigured || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) return null;

  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: userId,
    name: username,
    ttl: TOKEN_TTL_SECONDS,
  });

  at.addGrant({
    room: roomCode,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: false,
  });

  return at.toJwt();
}

export function getLivekitUrl(): string | undefined {
  return LIVEKIT_URL;
}
