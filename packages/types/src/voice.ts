/**
 * This file contains types related to voice functionality in the application.
 * It defines the structure of the payload that is sent when a voice token is issued.
 * The VoiceTokenPayload interface includes the token, the LiveKit URL, and the room name.
 */

export interface VoiceTokenPayload {
  token: string;
  livekitUrl: string;
  roomName: string;
}
