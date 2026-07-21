/**
 * Voice controls for the Arena lobby.
 *
 * This component renders the connection state, mute/deafen controls,
 * microphone and speaker selectors, and the disconnect action.
 * It also hides output-device switching when the current browser does
 * not support HTMLMediaElement.setSinkId.
 */
'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Headphones, PhoneOff, Loader2, Check, ChevronUp, Users } from 'lucide-react';
export type VoiceStatus = 'idle' | 'connecting' | 'connected' | 'error';

/**
 * Custom slashed-headphones icon used for the deafen state.
 */
const HeadphonesOff = ({ size = 18, strokeWidth = 2.5, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
    <line x1="2" y1="2" x2="22" y2="22" />
  </svg>
);

/**
 * Lightweight hover tooltip used by the icon buttons.
 */
const ActionTooltip = ({ text }: { text: string }) => (
  <div className="absolute bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2 scale-0 opacity-0 group-hover:scale-100 group-hover:opacity-100 transition-all duration-200 ease-out z-50 pointer-events-none origin-bottom">
    <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap shadow-xl">
      {text}
      <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-gray-900 dark:bg-white rotate-45" />
    </div>
  </div>
);

/**
 * Props for the voice control panel.
 *
 * Callbacks are passed in from the surrounding room state so the component
 * stays presentational and only handles local menu state.
 */
interface VoiceControlsProps {
  /** Current voice connection status. */
  status: VoiceStatus;
  /** Connection error shown when reconnecting is possible. */
  error: string | null;
  /** Whether the local microphone is muted. */
  isMuted: boolean;
  /** Whether voice output is disabled. */
  isDeafened: boolean;
  /** Number of players currently connected to voice. */
  connectedCount: number;
  /** Available microphone devices. */
  audioInputs: MediaDeviceInfo[];
  /** Available speaker/output devices. */
  audioOutputs: MediaDeviceInfo[];
  /** Currently selected microphone device id. */
  selectedAudioInput: string;
  /** Currently selected speaker device id. */
  selectedAudioOutput: string;
  /** Starts the voice connection flow. */
  onConnect: () => void;
  /** Ends the current voice connection. */
  onDisconnect: () => void;
  /** Toggles local mute state. */
  onToggleMute: () => void;
  /** Toggles local deafen state. */
  onToggleDeafen: () => void;
  /** Switches the active microphone device. */
  onSwitchAudioInput: (deviceId: string) => void;
  /** Switches the active speaker/output device. */
  onSwitchAudioOutput: (deviceId: string) => void;
  /** Controls sizing and spacing for compact or default layouts. */
  variant?: 'default' | 'compact';
}

/**
 * Renders the voice connection controls for the Arena screen.
 *
 * States:
 * - `idle` and `error` show a single connect/retry button.
 * - `connecting` shows a loading indicator.
 * - `connected` exposes mute, deafen, device selection, player count,
 *   and disconnect actions.
 */
export const VoiceControls = ({
  status,
  error,
  isMuted,
  isDeafened,
  connectedCount,
  audioInputs,
  audioOutputs,
  selectedAudioInput,
  selectedAudioOutput,
  onConnect,
  onDisconnect,
  onToggleMute,
  onToggleDeafen,
  onSwitchAudioInput,
  onSwitchAudioOutput,
  variant = 'default',
}: VoiceControlsProps) => {
  // Hide output device switching when the browser does not support setSinkId.
  const isOutputSwitchingSupported =
    typeof window !== 'undefined' &&
    typeof HTMLMediaElement !== 'undefined' &&
    'setSinkId' in HTMLMediaElement.prototype;

  const [openMenu, setOpenMenu] = useState<'input' | 'output' | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    if (openMenu) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openMenu]);

  const isCompact = variant === 'compact';
  const iconSize = isCompact ? 16 : 18;
  const btnClass = isCompact ? 'w-9 h-9 rounded-l-md' : 'w-10 h-10 rounded-l-lg';
  const singleBtnClass = isCompact ? 'w-9 h-9 rounded-md' : 'w-12 h-10 rounded-lg';
  const chevronClass = isCompact ? 'w-6 h-9 rounded-r-md' : 'w-7 h-10 rounded-r-lg';
  const innerWrapClass = isCompact ? 'rounded-lg' : 'rounded-xl';

  if (status === 'idle' || status === 'error') {
    return (
      <div className="flex flex-col gap-1 w-full max-w-sm mx-auto">
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onConnect}
          className={`w-full flex items-center justify-center gap-2 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white rounded-2xl font-black border-b-4 border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 transition-all shadow-sm ${isCompact ? 'py-2.5 text-sm' : 'py-3 text-sm md:text-base'}`}
        >
          <Mic size={iconSize + 2} strokeWidth={2.5} />
          {error ? 'Retry Voice Connection' : 'Connect to Voice'}
        </motion.button>
        {error && (
          <span className="text-red-500 dark:text-neon-pink font-bold text-xs text-center">
            {error}
          </span>
        )}
      </div>
    );
  }

  if (status === 'connecting') {
    return (
      <div
        className={`w-full max-w-sm mx-auto flex items-center justify-center gap-3 bg-gray-100 dark:bg-discord-main border-2 border-gray-200 dark:border-gray-800 text-gray-500 dark:text-gray-400 rounded-2xl font-black shadow-sm ${isCompact ? 'py-2.5 text-sm' : 'py-3 text-sm md:text-base'}`}
      >
        <Loader2 size={iconSize + 2} className="animate-spin" strokeWidth={2.5} />
        Connecting...
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      // THE FIX: w-fit mx-auto completely prevents those ugly gaps.
      // It hugs the buttons tightly no matter the screen size.
      className={`relative flex items-center justify-center mx-auto bg-white dark:bg-discord-card border-2 border-gray-200 dark:border-discord-main shadow-sm w-fit max-w-full transition-all ${
        isCompact ? 'p-1 gap-1 rounded-xl' : 'p-1.5 sm:p-2 gap-1.5 sm:gap-2.5 rounded-2xl'
      }`}
    >
      {/* LEFT SIDE: Mic & Speaker Split Buttons */}
      <div className={`flex items-center shrink-0 ${isCompact ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
        {/* --- MIC SPLIT BUTTON --- */}
        <div className="relative">
          <div
            className={`flex items-center border-2 transition-all ${innerWrapClass} ${
              isMuted || isDeafened
                ? 'bg-red-100 dark:bg-neon-pink/20 border-red-500 dark:border-neon-pink text-red-600 dark:text-neon-pink shadow-inner'
                : 'bg-green-100 dark:bg-neon-blue/20 border-green-500 dark:border-neon-blue text-green-600 dark:text-neon-blue'
            } ${isDeafened ? 'opacity-50' : ''}`}
          >
            <button
              onClick={onToggleMute}
              disabled={isDeafened}
              className={`group relative flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all disabled:cursor-not-allowed ${btnClass}`}
            >
              {isMuted || isDeafened ? (
                <MicOff size={iconSize} strokeWidth={2.5} />
              ) : (
                <Mic size={iconSize} strokeWidth={2.5} />
              )}
              <ActionTooltip text={isMuted ? 'Unmute' : 'Mute'} />
            </button>

            <div className={`w-0.5 bg-current opacity-20 ${isCompact ? 'h-5' : 'h-6'}`} />

            <button
              onClick={() => setOpenMenu(openMenu === 'input' ? null : 'input')}
              className={`group relative flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all ${chevronClass}`}
            >
              <ChevronUp
                size={14}
                strokeWidth={3}
                className={`transition-transform ${openMenu === 'input' ? 'rotate-180' : ''}`}
              />
              <ActionTooltip text="Select Microphone" />
            </button>
          </div>

          {/* Mic Menu (Pushes Right) */}
          <AnimatePresence>
            {openMenu === 'input' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                // THE FIX: Anchored left-0 so it pushes right into empty space
                className="absolute left-0 bottom-[calc(100%+8px)] w-65 max-w-[85vw] bg-white dark:bg-discord-card border-4 border-gray-200 dark:border-discord-main rounded-3xl p-2 shadow-2xl z-50 flex flex-col gap-1 origin-bottom-left"
              >
                <div className="flex items-center gap-2 px-2 pt-1 pb-2.5 mb-1 border-b-2 border-gray-100 dark:border-gray-800">
                  <Mic size={14} className="text-gray-400 dark:text-gray-500" strokeWidth={3} />
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Input Device
                  </span>
                </div>
                <div className="flex flex-col gap-1 max-h-[35vh] overflow-y-auto scrollbar-none">
                  {audioInputs.length === 0 ? (
                    <span className="text-xs font-bold text-red-500 dark:text-neon-pink px-2 pb-2">
                      No microphones found
                    </span>
                  ) : (
                    audioInputs.map((device) => (
                      <button
                        key={device.deviceId}
                        onClick={() => {
                          onSwitchAudioInput(device.deviceId);
                          setOpenMenu(null);
                        }}
                        className={`group text-left text-xs font-bold px-3 py-2.5 rounded-xl truncate flex items-center justify-between transition-all duration-200 border-2 ${
                          selectedAudioInput === device.deviceId
                            ? 'bg-green-50 dark:bg-neon-blue/10 border-green-500 dark:border-neon-blue text-green-700 dark:text-neon-blue shadow-sm'
                            : 'bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-discord-main hover:translate-x-1 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${selectedAudioInput === device.deviceId ? 'bg-green-500 dark:bg-neon-blue' : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-400'}`}
                          />
                          <span className="truncate pr-2">
                            {device.label || 'Default Microphone'}
                          </span>
                        </div>
                        {selectedAudioInput === device.deviceId && (
                          <Check size={14} strokeWidth={3} className="shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* --- HEADPHONES SPLIT BUTTON --- */}
        <div className="relative">
          <div
            className={`flex items-center border-2 transition-all ${innerWrapClass} ${
              isDeafened
                ? 'bg-red-100 dark:bg-neon-pink/20 border-red-500 dark:border-neon-pink text-red-600 dark:text-neon-pink shadow-inner'
                : 'bg-green-100 dark:bg-neon-blue/20 border-green-500 dark:border-neon-blue text-green-600 dark:text-neon-blue'
            }`}
          >
            <button
              onClick={onToggleDeafen}
              className={`group relative flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all ${isOutputSwitchingSupported ? btnClass : singleBtnClass}`}
            >
              {isDeafened ? (
                <HeadphonesOff size={iconSize} strokeWidth={2.5} />
              ) : (
                <Headphones size={iconSize} strokeWidth={2.5} />
              )}
              <ActionTooltip text={isDeafened ? 'Undeafen' : 'Deafen'} />
            </button>

            {isOutputSwitchingSupported && (
              <>
                <div className={`w-0.5 bg-current opacity-20 ${isCompact ? 'h-5' : 'h-6'}`} />
                <button
                  onClick={() => setOpenMenu(openMenu === 'output' ? null : 'output')}
                  className={`group relative flex items-center justify-center hover:bg-black/5 dark:hover:bg-white/5 active:scale-95 transition-all ${chevronClass}`}
                >
                  <ChevronUp
                    size={14}
                    strokeWidth={3}
                    className={`transition-transform ${openMenu === 'output' ? 'rotate-180' : ''}`}
                  />
                  <ActionTooltip text="Select Output Device" />
                </button>
              </>
            )}
          </div>

          {/* Speaker Menu */}
          <AnimatePresence>
            {openMenu === 'output' && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                transition={{ duration: 0.15 }}
                className="absolute left-1/2 -translate-x-1/2 bottom-[calc(100%+8px)] w-65 max-w-[85vw] bg-white dark:bg-discord-card border-4 border-gray-200 dark:border-discord-main rounded-3xl p-2 shadow-2xl z-50 flex flex-col gap-1 origin-bottom"
              >
                <div className="flex items-center gap-2 px-2 pt-1 pb-2.5 mb-1 border-b-2 border-gray-100 dark:border-gray-800">
                  <Headphones
                    size={14}
                    className="text-gray-400 dark:text-gray-500"
                    strokeWidth={3}
                  />
                  <span className="text-[10px] font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest">
                    Output Device
                  </span>
                </div>
                <div className="flex flex-col gap-1 max-h-[35vh] overflow-y-auto scrollbar-none">
                  {audioOutputs.length === 0 ? (
                    <span className="text-xs font-bold text-gray-500 px-2 pb-2">
                      Default System Output
                    </span>
                  ) : (
                    audioOutputs.map((device) => (
                      <button
                        key={device.deviceId}
                        onClick={() => {
                          onSwitchAudioOutput(device.deviceId);
                          setOpenMenu(null);
                        }}
                        className={`group text-left text-xs font-bold px-3 py-2.5 rounded-xl truncate flex items-center justify-between transition-all duration-200 border-2 ${
                          selectedAudioOutput === device.deviceId
                            ? 'bg-green-50 dark:bg-neon-blue/10 border-green-500 dark:border-neon-blue text-green-700 dark:text-neon-blue shadow-sm'
                            : 'bg-transparent border-transparent hover:border-gray-200 dark:hover:border-gray-700 hover:bg-gray-50 dark:hover:bg-discord-main hover:translate-x-1 text-gray-600 dark:text-gray-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <div
                            className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${selectedAudioOutput === device.deviceId ? 'bg-green-500 dark:bg-neon-blue' : 'bg-gray-300 dark:bg-gray-600 group-hover:bg-gray-400'}`}
                          />
                          <span className="truncate pr-2">{device.label || 'Default Speaker'}</span>
                        </div>
                        {selectedAudioOutput === device.deviceId && (
                          <Check size={14} strokeWidth={3} className="shrink-0" />
                        )}
                      </button>
                    ))
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* RIGHT SIDE: Connection Info & Disconnect Button */}
      <div className={`flex items-center shrink-0 ${isCompact ? 'gap-1' : 'gap-1.5 sm:gap-2'}`}>
        <div
          className={`group relative text-[10px] font-black uppercase tracking-widest text-green-600 dark:text-neon-blue bg-green-50 dark:bg-neon-blue/10 rounded-lg border border-green-200 dark:border-neon-blue/30 flex items-center justify-center shadow-sm shrink-0 transition-all cursor-help ${
            isCompact ? 'h-9 px-2 gap-1' : 'h-10 sm:h-7 px-2.5 sm:px-2 gap-1.5 sm:gap-1'
          }`}
        >
          <Users size={12} strokeWidth={3} />
          <span>
            {connectedCount}{' '}
            <span className={isCompact ? 'hidden' : 'hidden sm:inline'}>Connected</span>
            <ActionTooltip
              text={`${connectedCount} ${connectedCount === 1 ? 'Player' : 'Players'} Connected`}
            />
          </span>
        </div>

        <button
          onClick={onDisconnect}
          className={`group relative flex items-center justify-center rounded-lg border-2 bg-red-50 dark:bg-neon-pink/10 border-red-200 dark:border-neon-pink/30 text-red-500 dark:text-neon-pink hover:bg-red-100 dark:hover:bg-neon-pink/20 hover:border-red-400 dark:hover:border-neon-pink active:scale-95 transition-all shadow-sm shrink-0 ${isCompact ? 'w-9 h-9' : 'w-10 h-10'}`}
          title="Disconnect from Voice"
        >
          <PhoneOff size={iconSize} strokeWidth={2.5} />
          <ActionTooltip text="Disconnect" />
        </button>
      </div>
    </div>
  );
};
