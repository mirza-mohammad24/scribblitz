/**
 * Owns the LiveKit `Room` connection lifecycle for in-game voice chat.
 *
 * Flow: once the caller invokes `connect()`, we ask the game server (over the
 * existing authenticated Socket.IO connection) for a short-lived LiveKit token
 * via `ClientEvents.VOICE_TOKEN_REQUEST`, then use that token to connect
 * directly to LiveKit Cloud. From that point on, voice media flows entirely
 * between this browser and LiveKit's SFU — the game server is never in the
 * audio path.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Socket } from 'socket.io-client';
import {
  Room,
  RoomEvent,
  Track,
  RemoteParticipant,
  RemoteTrack,
  ConnectionState,
} from 'livekit-client';
import { ClientEvents, ServerEvents, VoiceTokenPayload } from '@scribblitz/types';

export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

interface UseVoiceChatResult {
  status: VoiceStatus;
  error: string | null;
  isMuted: boolean;
  isDeafened: boolean;
  speakingUserIds: Set<string>;
  connectedUserIds: Set<string>;
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedAudioInput: string;
  selectedAudioOutput: string;
  connect: () => void;
  disconnect: () => void;
  toggleMute: () => void;
  toggleDeafen: () => void;
  switchAudioInput: (deviceId: string) => Promise<void>;
  switchAudioOutput: (deviceId: string) => Promise<void>;
}

export function useVoiceChat(socket: Socket | null, userId: string | null): UseVoiceChatResult {
  const [status, setStatus] = useState<VoiceStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  //Voice Controls State
  const [isMuted, setIsMuted] = useState(false);
  const [isDeafened, setIsDeafened] = useState(false);

  //Participant Tracking
  const [speakingUserIds, setSpeakingUserIds] = useState<Set<string>>(new Set());
  const [connectedUserIds, setConnectedUserIds] = useState<Set<string>>(new Set());

  //Hardware Devices State
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>('');
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>('');

  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);

  // Track deafen state in a ref so event listener closures always have the latest value
  const isDeafenedRef = useRef(isDeafened);
  useEffect(() => {
    isDeafenedRef.current = isDeafened;
  }, [isDeafened]);

  // Stash the token listener so we can cleanly unregister it to prevent orphaned sessions
  const onTokenIssuedRef = useRef<((payload: VoiceTokenPayload) => Promise<void>) | null>(null);

  // Hidden DOM container for remote participant <audio> elements
  const getAudioContainer = useCallback(() => {
    if (!audioContainerRef.current) {
      const el = document.createElement('div');
      el.style.display = 'none';
      el.id = 'livekit-audio-container';
      document.body.appendChild(el);
      audioContainerRef.current = el;
    }
    return audioContainerRef.current;
  }, []);

  // Fetch available hardware devices
  const refreshDevices = useCallback(async () => {
    try {
      const inputs = await Room.getLocalDevices('audioinput');
      const outputs = await Room.getLocalDevices('audiooutput');
      setAudioInputs(inputs);
      setAudioOutputs(outputs);
    } catch (err) {
      console.warn('[VoiceChat] Could not enumerate audio devices:', err);
    }
  }, []);

  //Attach remote audio tracks to DOM so players can hear each other
  const attachRemoteTrack = useCallback(
    (track: RemoteTrack, participant: RemoteParticipant) => {
      if (track.kind !== Track.Kind.Audio) return;
      const el = track.attach();
      //Immediately respect the current deafen state for newly joined participants
      el.muted = isDeafenedRef.current;
      el.dataset.participantIdentity = participant.identity;
      getAudioContainer().appendChild(el);
    },
    [getAudioContainer],
  );

  const detachRemoteTrack = useCallback((track: RemoteTrack) => {
    track.detach().forEach((el) => el.remove());
  }, []);

  const disconnect = useCallback(() => {
    //  Cancel any pending token requests if we disconnect early
    if (socket && onTokenIssuedRef.current) {
      socket.off(ServerEvents.VOICE_TOKEN_ISSUED, onTokenIssuedRef.current);
    }

    roomRef.current?.disconnect();
    roomRef.current = null;

    if (audioContainerRef.current) {
      audioContainerRef.current.remove();
      audioContainerRef.current = null;
    }

    setStatus('idle');
    setIsMuted(false);
    setIsDeafened(false);
    setSpeakingUserIds(new Set());
    setConnectedUserIds(new Set());
    setError(null);
  }, [socket]);

  const connect = useCallback(() => {
    if (!socket || !userId || roomRef.current || status === 'connecting') return;

    setStatus('connecting');
    setError(null);

    const onTokenIssued = async (payload: VoiceTokenPayload) => {
      try {
        const room = new Room({
          adaptiveStream: true,
          dynacast: true,
          audioCaptureDefaults: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        roomRef.current = room;

        //Room Event Listeners
        room
          .on(RoomEvent.TrackSubscribed, (track, _pub, participant) =>
            attachRemoteTrack(track, participant),
          )
          .on(RoomEvent.TrackUnsubscribed, (track) => detachRemoteTrack(track))
          .on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
            setSpeakingUserIds(new Set(speakers.map((p) => p.identity)));
          })
          .on(RoomEvent.ParticipantConnected, (p) =>
            setConnectedUserIds((prev) => new Set(prev).add(p.identity)),
          )
          .on(RoomEvent.ParticipantDisconnected, (p) =>
            setConnectedUserIds((prev) => {
              const next = new Set(prev);
              next.delete(p.identity);
              return next;
            }),
          )
          .on(RoomEvent.ConnectionStateChanged, (state) => {
            if (state === ConnectionState.Disconnected) setStatus('idle');
          })
          .on(RoomEvent.Disconnected, () => disconnect());

        //Connect directly to Livekit SFU
        await room.connect(payload.livekitUrl, payload.token);

        //Enable local microphone by default on join
        await room.localParticipant.setMicrophoneEnabled(true);

        //Record active connected players
        const initialIds = new Set<string>([room.localParticipant.identity]);
        room.remoteParticipants.forEach((p) => initialIds.add(p.identity));
        setConnectedUserIds(initialIds);

        //Fetch device lists & set defaults
        await refreshDevices();

        setStatus('connected');
      } catch (err) {
        console.error('[Voice Chat] Connection failed:', err);

        // Tear down any partial connection before nullifying the reference
        roomRef.current?.disconnect();
        roomRef.current = null;

        setError(err instanceof Error ? err.message : 'Voice connection failed');
        setStatus('error');
        roomRef.current = null;
      }
    };

    onTokenIssuedRef.current = onTokenIssued;
    socket.once(ServerEvents.VOICE_TOKEN_ISSUED, onTokenIssued);
    socket.emit(ClientEvents.VOICE_TOKEN_REQUEST);
  }, [socket, userId, status, attachRemoteTrack, detachRemoteTrack, disconnect, refreshDevices]);

  //Discord like mute/deafen matrix
  const toggleMute = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    //Rule: Cannot unmute if deafened
    if (isDeafened) return;

    const nextMuted = !isMuted;
    room.localParticipant.setMicrophoneEnabled(!nextMuted);
    setIsMuted(nextMuted);
  }, [isMuted, isDeafened]);

  const toggleDeafen = useCallback(() => {
    const room = roomRef.current;
    if (!room) return;

    const nextDeafened = !isDeafened;
    setIsDeafened(nextDeafened);

    //Instantly update the ref so any mid-toggle joins read it properly
    isDeafenedRef.current = nextDeafened;

    if (nextDeafened) {
      //Deafening automatically mutes mic & mutes incoming audio
      room.localParticipant.setMicrophoneEnabled(false);
      setIsMuted(true);

      const audioContainer = getAudioContainer();
      audioContainer.querySelectorAll('audio').forEach((el) => {
        el.muted = true;
      });
    } else {
      //Undeafening unmuted incoming audio (mic stays muted for safety)
      const audioContainer = getAudioContainer();
      audioContainer.querySelectorAll('audio').forEach((el) => {
        el.muted = false;
      });
    }
  }, [isDeafened, getAudioContainer]);

  // --- DEVICE SWITCHING ---

  const switchAudioInput = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.switchActiveDevice('audioinput', deviceId);
      setSelectedAudioInput(deviceId);
    } catch (err) {
      console.error('[Voice Chat] Failed to switch microphone:', err);
    }
  }, []);

  const switchAudioOutput = useCallback(async (deviceId: string) => {
    const room = roomRef.current;
    if (!room) return;

    try {
      await room.switchActiveDevice('audiooutput', deviceId);
      setSelectedAudioOutput(deviceId);
    } catch (err) {
      console.error('[Voice Chat] Failed to switch audio output:', err);
    }
  }, []);

  //Teardown on unmount
  useEffect(() => {
    return () => {
      //Cleanup pending listeners on unmount
      if (socket && onTokenIssuedRef.current) {
        socket.off(ServerEvents.VOICE_TOKEN_ISSUED, onTokenIssuedRef.current);
      }
      roomRef.current?.disconnect();
      audioContainerRef.current?.remove();
    };
  }, [socket]);

  return {
    status,
    error,
    isMuted,
    isDeafened,
    speakingUserIds,
    connectedUserIds,
    audioInputs,
    audioOutputs,
    selectedAudioInput,
    selectedAudioOutput,
    connect,
    disconnect,
    toggleMute,
    toggleDeafen,
    switchAudioInput,
    switchAudioOutput,
  };
}
