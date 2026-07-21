/**
 * Mobile action menus for the Arena screen.
 *
 * Renders two radial (circular) menus anchored to the left and right edges:
 * - Left: settings (theme, players, chat, logout)
 * - Right: voice controls (mute, deafen, disconnect)
 *
 * Hidden on medium+ screens; uses Framer Motion for spring-based radial animations.
 */
'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useTheme } from 'next-themes';
import {
  Settings,
  PhoneMissed,
  PhoneCall,
  PhoneOff,
  Users,
  Moon,
  Sun,
  LogOut,
  MessageCircle,
  Mic,
  MicOff,
  Headphones,
  Loader2,
} from 'lucide-react';
import { VoiceStatus } from './VoiceControls';

/**
 * Custom slashed-headphones icon used for the deafen state.
 */
const CustomHeadphonesOff = ({ size = 20, className = '' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
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
 * Props for the mobile action menus.
 *
 * All callbacks are delegated to parent; this component only manages
 * the open/closed state of each radial menu.
 */
interface MobileActionMenusProps {
  /** Whether chat is displayed in a drawer (affects menu content). */
  isDrawer: boolean;
  /** Opens the players list modal. */
  onOpenPlayers: () => void;
  /** Opens the chat drawer. */
  onOpenChat: () => void;
  /** Initiates the leave-game flow. */
  onRequestLeave: () => void;
  /** Current voice connection status. */
  voiceStatus: VoiceStatus;
  /** Whether the local microphone is muted. */
  isMuted: boolean;
  /** Whether voice output is disabled. */
  isDeafened: boolean;
  /** Starts the voice connection flow. */
  onConnectVoice: () => void;
  /** Ends the current voice connection. */
  onDisconnectVoice: () => void;
  /** Toggles local mute state. */
  onToggleMute: () => void;
  /** Toggles local deafen state. */
  onToggleDeafen: () => void;
}

/** Radius of the radial menu arc. */
const RADIUS = 115;

/**
 * Button positions for the right-side (voice) radial menu.
 * Arranged in a 3-item arc pointing upward and to the left.
 */
const rightCoords = [
  { x: -RADIUS, y: 0 },
  { x: Math.round(-RADIUS * 0.707), y: Math.round(-RADIUS * 0.707) },
  { x: 0, y: -RADIUS },
];

/**
 * Button positions for the left-side (settings) radial menu when 3 items.
 * Arranged in a 3-item arc pointing upward and to the right.
 */
const leftCoords3 = [
  { x: 0, y: -RADIUS },
  { x: Math.round(RADIUS * 0.707), y: Math.round(-RADIUS * 0.707) },
  { x: RADIUS, y: 0 },
];

/**
 * Button positions for the left-side (settings) radial menu when 4 items (chat included).
 * Arranged in a 4-item arc pointing upward and to the right.
 */
const leftCoords4 = [
  { x: 0, y: -RADIUS },
  { x: Math.round(RADIUS * 0.5), y: Math.round(-RADIUS * 0.866) },
  { x: Math.round(RADIUS * 0.866), y: Math.round(-RADIUS * 0.5) },
  { x: RADIUS, y: 0 },
];

/**
 * Spring-based animation variants for radial menu items.
 *
 * Items pop in and scale from the center with staggered delays,
 * then collapse back on exit.
 */
const radialVariants: Variants = {
  hidden: { opacity: 0, x: 0, y: 0, scale: 0.1 },
  visible: ({ x, y, i }: { x: number; y: number; i: number }) => ({
    opacity: 1,
    x,
    y,
    scale: 1,
    transition: {
      type: 'spring',
      stiffness: 450,
      damping: 25,
      delay: i * 0.04,
    },
  }),
  exit: ({ i }: { i: number }) => ({
    opacity: 0,
    x: 0,
    y: 0,
    scale: 0.1,
    transition: { duration: 0.15, delay: i * 0.03 },
  }),
};

/**
 * Renders the mobile action menu (hidden on md+ screens).
 *
 * Left menu (settings): theme, players, chat, logout.
 * Right menu (voice): mute, deafen, disconnect (when connected).
 *
 * Tap the voice button to:
 * - Connect if idle/errored
 * - Open voice menu if connected
 * - Show loading spinner if connecting
 */
export const MobileActionMenus = ({
  isDrawer,
  onOpenPlayers,
  onOpenChat,
  onRequestLeave,
  voiceStatus,
  isMuted,
  isDeafened,
  onConnectVoice,
  onDisconnectVoice,
  onToggleMute,
  onToggleDeafen,
}: MobileActionMenusProps) => {
  const { theme, setTheme } = useTheme();
  const [activeRadial, setActiveRadial] = useState<'settings' | 'voice' | null>(null);

  const toggleRadial = (menu: 'settings' | 'voice') => {
    setActiveRadial(activeRadial === menu ? null : menu);
  };

  const handleVoiceTap = () => {
    if (voiceStatus === 'idle' || voiceStatus === 'error') {
      onConnectVoice();
    } else if (voiceStatus === 'connected') {
      toggleRadial('voice');
    }
  };

  const settingsItems = [
    {
      icon: <LogOut size={20} />,
      bg: 'bg-red-50 dark:bg-red-500/20 text-red-600 dark:text-neon-pink border-red-200 dark:border-neon-pink/40',
      action: onRequestLeave,
    },
    {
      icon: theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />,
      bg: 'bg-green-50 dark:bg-neon-blue/20 text-green-600 dark:text-neon-blue border-green-200 dark:border-neon-blue/40',
      action: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
    },
    {
      icon: <Users size={20} />,
      bg: 'bg-green-50 dark:bg-neon-blue/20 text-green-600 dark:text-neon-blue border-green-200 dark:border-neon-blue/40',
      action: () => {
        setActiveRadial(null);
        onOpenPlayers();
      },
    },
    ...(isDrawer
      ? [
          {
            icon: <MessageCircle size={20} />,
            bg: 'bg-green-50 dark:bg-neon-blue/20 text-green-600 dark:text-neon-blue border-green-200 dark:border-neon-blue/40',
            action: () => {
              setActiveRadial(null);
              onOpenChat();
            },
          },
        ]
      : []),
  ];

  const voiceItems = [
    {
      icon: <PhoneOff size={20} />,
      bg: 'bg-red-50 dark:bg-neon-pink/20 text-red-500 dark:text-neon-pink border-red-200 dark:border-neon-pink/30',
      action: () => {
        setActiveRadial(null);
        onDisconnectVoice();
      },
      disabled: false,
    },
    {
      icon: isDeafened ? <CustomHeadphonesOff size={20} /> : <Headphones size={20} />,
      bg: isDeafened
        ? 'bg-red-100 dark:bg-neon-pink/30 text-red-600 dark:text-neon-pink border-red-400 dark:border-neon-pink/50 shadow-inner'
        : 'bg-green-50 dark:bg-neon-blue/20 text-green-600 dark:text-neon-blue border-green-200 dark:border-neon-blue/30',
      action: onToggleDeafen,
      disabled: false,
    },
    {
      icon: isMuted || isDeafened ? <MicOff size={20} /> : <Mic size={20} />,
      bg:
        isMuted || isDeafened
          ? 'bg-red-100 dark:bg-neon-pink/30 text-red-600 dark:text-neon-pink border-red-400 dark:border-neon-pink/50 shadow-inner'
          : 'bg-green-50 dark:bg-neon-blue/20 text-green-600 dark:text-neon-blue border-green-200 dark:border-neon-blue/30',
      action: onToggleMute,
      disabled: isDeafened,
    },
  ];

  const leftCoords = settingsItems.length === 4 ? leftCoords4 : leftCoords3;

  return (
    <>
      <AnimatePresence>
        {activeRadial && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 bg-black/10 backdrop-blur-[1px]"
            onClick={() => setActiveRadial(null)}
          />
        )}
      </AnimatePresence>

      <div className="md:hidden flex justify-between w-full shrink-0 relative z-50 px-2 mt-1 -mb-1">
        {/* LEFT EDGE: Settings Radial */}
        <div className="relative w-12 h-12">
          <AnimatePresence>
            {activeRadial === 'settings' && (
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-40">
                {settingsItems.map((item, i) => (
                  <motion.button
                    key={i}
                    custom={{ ...leftCoords[i], i }}
                    variants={radialVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={item.action}
                    className={`absolute top-0 left-0 w-12 h-12 flex items-center justify-center rounded-full border-2 shadow-xl active:scale-95 transition-colors pointer-events-auto ${item.bg}`}
                  >
                    {item.icon}
                  </motion.button>
                ))}
              </div>
            )}
          </AnimatePresence>
          <button
            onClick={() => toggleRadial('settings')}
            className="absolute top-0 left-0 w-12 h-12 flex items-center justify-center rounded-full bg-white dark:bg-discord-card border-2 border-gray-200 dark:border-discord-main text-gray-700 dark:text-gray-300 shadow-md active:scale-95 z-50"
          >
            <Settings
              size={22}
              strokeWidth={2.5}
              className={
                activeRadial === 'settings'
                  ? 'rotate-90 transition-transform'
                  : 'transition-transform'
              }
            />
          </button>
        </div>

        {/* RIGHT EDGE: Voice Radial */}
        <div className="relative w-12 h-12">
          <AnimatePresence>
            {activeRadial === 'voice' && voiceStatus === 'connected' && (
              <div className="absolute top-0 left-0 w-full h-full pointer-events-none z-40">
                {voiceItems.map((item, i) => (
                  <motion.button
                    key={i}
                    custom={{ ...rightCoords[i], i }}
                    variants={radialVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onClick={item.action}
                    disabled={item.disabled}
                    className={`absolute top-0 left-0 w-12 h-12 flex items-center justify-center rounded-full border-2 shadow-xl transition-colors pointer-events-auto ${item.bg} ${item.disabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-95'}`}
                  >
                    {item.icon}
                  </motion.button>
                ))}
              </div>
            )}
          </AnimatePresence>
          <button
            onClick={handleVoiceTap}
            className={`absolute top-0 left-0 w-12 h-12 flex items-center justify-center rounded-full border-2 shadow-md active:scale-95 z-50 transition-colors ${
              voiceStatus === 'connected'
                ? 'bg-green-500 dark:bg-neon-blue border-green-600 dark:border-blue-900 text-white'
                : voiceStatus === 'connecting'
                  ? 'bg-yellow-500 dark:bg-yellow-600 border-yellow-600 dark:border-yellow-700 text-white'
                  : 'bg-white dark:bg-discord-card border-gray-200 dark:border-discord-main text-gray-700 dark:text-gray-300'
            }`}
          >
            {voiceStatus === 'connecting' ? (
              <Loader2 size={22} className="animate-spin" />
            ) : voiceStatus === 'connected' ? (
              <PhoneCall size={22} strokeWidth={2.5} />
            ) : (
              <PhoneMissed size={22} strokeWidth={2.5} />
            )}
          </button>
        </div>
      </div>
    </>
  );
};
