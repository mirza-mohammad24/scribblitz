/**
 * Custom React hook that manages the in-game LiveKit voice chat lifecycle.
 *
 * The hook requests a short-lived LiveKit token from the game server over the
 * authenticated Socket.IO connection, then uses that token to connect directly
 * to LiveKit Cloud. After the room is established, it tracks participants,
 * device lists, mute/deafen state, and remote audio attachments so the UI can
 * render a Discord-like voice experience.
 *
 * @param socket - The authenticated Socket.IO client used to request a voice token.
 * @param userId - The current player ID. Voice chat stays idle until this is available.
 * @returns An object containing the voice connection state, participant tracking, device lists, and voice controls.
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

/**
 * Chrome on Windows exposes up to 3 entries for a single physical audio device:
 * the real device, a "default"-role alias, and a "communications"-role alias —
 * all three sharing the same `groupId`. `Room.getLocalDevices()` only strips the
 * literal "default" alias, leaving the "Communications -" one behind. This
 * collapses each group down to one canonical row (preferring the plain
 * physical-device label), matching what apps like Google Meet render.
 *
 * Also returns `resolveCanonicalId`, since `room.getActiveDevice()` can report
 * the literal alias id (e.g. 'default') rather than the physical device's real
 * id — this lets callers translate either back to whichever id the deduped
 * list actually uses, so "currently selected" highlighting and change-detection
 * both line up with what's rendered.
 */
function dedupeAudioDevices(devices: MediaDeviceInfo[]): {
  deduped: MediaDeviceInfo[];
  resolveCanonicalId: (deviceId: string) => string;
} {
  const byGroup = new Map<string, MediaDeviceInfo[]>();

  for (const device of devices) {
    const key = device.groupId || device.deviceId; // fall back if groupId is empty
    const group = byGroup.get(key) ?? [];
    group.push(device);
    byGroup.set(key, group);
  }

  const deduped: MediaDeviceInfo[] = [];
  const idToCanonical = new Map<string, string>();

  for (const group of byGroup.values()) {
    const canonical =
      group.find(
        (d) => !d.label.startsWith('Default -') && !d.label.startsWith('Communications -'),
      ) ?? group[0];

    deduped.push(canonical);
    for (const d of group) {
      idToCanonical.set(d.deviceId, canonical.deviceId);
    }
  }

  return {
    deduped,
    resolveCanonicalId: (deviceId: string) => idToCanonical.get(deviceId) ?? deviceId,
  };
}

/**
 * Public API returned by {@link useVoiceChat}.
 */
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
  const isConnectingRef = useRef(false);

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
      const rawInputs = await Room.getLocalDevices('audioinput');
      const rawOutputs = await Room.getLocalDevices('audiooutput');

      const inputResult = dedupeAudioDevices(rawInputs);
      const outputResult = dedupeAudioDevices(rawOutputs);
      setAudioInputs(inputResult.deduped);
      setAudioOutputs(outputResult.deduped);

      const room = roomRef.current;
      if (!room) return;

      const activeInput = room.getActiveDevice('audioinput');
      const activeOutput = room.getActiveDevice('audiooutput');
      if (activeInput) setSelectedAudioInput(inputResult.resolveCanonicalId(activeInput));
      if (activeOutput) setSelectedAudioOutput(outputResult.resolveCanonicalId(activeOutput));
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
    isConnectingRef.current = false;
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
    if (!socket || !userId || roomRef.current || isConnectingRef.current) return;
    isConnectingRef.current = true;

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
          .on(RoomEvent.MediaDevicesChanged, () => {
            refreshDevices();
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
      } finally {
        isConnectingRef.current = false;
      }
    };

    onTokenIssuedRef.current = onTokenIssued;
    socket.once(ServerEvents.VOICE_TOKEN_ISSUED, onTokenIssued);
    socket.emit(ClientEvents.VOICE_TOKEN_REQUEST);
  }, [socket, userId, attachRemoteTrack, detachRemoteTrack, disconnect, refreshDevices]);

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
