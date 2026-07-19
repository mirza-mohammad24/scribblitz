/**
 * This file's purpose is to provide a utility function for sanitizing the RoomConfig object before sending it
 * over the network. The sanitizeConfig function removes sensitive information, specifically the customWordList
 * and replaces it with a count of custom words. This ensures that non-host players do not have access to the
 * raw word list, maintaining game integrity and security.
 */

import { RoomConfig } from '@scribblitz/types';

/**
 * Returns a sanitized copy of the config with customWordList stripped out and
 * replaced by a safe customWordCount. Prevents non-host players from seeing
 * the raw word list (custom or AI-generated) over the wire.
 */
export function sanitizeConfig(config: RoomConfig): RoomConfig {
  return {
    ...config,
    customWordList: undefined,
    customWordCount: config.customWordList?.length ?? 0,
  };
}
