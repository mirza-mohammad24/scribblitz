/**
 * Voice chat integration for the game server.
 *
 * This module is responsible for minting LiveKit access tokens when the voice
 * environment variables are configured. If LiveKit is not configured, the
 * module logs a warning at startup and token creation returns `null` so callers
 * can degrade gracefully.
 */
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

/**
 * Creates a LiveKit access token for a player joining a voice room.
 *
 * @param userId - The user identity embedded in the token.
 * @param roomCode - The voice room the token should allow access to.
 * @param username - The display name associated with the token.
 * @returns A signed JWT when voice chat is configured, or `null` when it is disabled.
 */
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

/**
 * Returns the configured LiveKit WebSocket URL, if voice chat is enabled.
 *
 * @returns The LiveKit server URL, or `undefined` when voice chat is disabled.
 */
export function getLivekitUrl(): string | undefined {
  return LIVEKIT_URL;
}
