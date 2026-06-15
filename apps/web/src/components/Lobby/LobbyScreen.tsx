'use client';

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Player, RoomConfig } from '@scribblitz/types';
import { Crown, Users, Settings2, LogOut, Copy, Check } from 'lucide-react';
import Image from 'next/image';
import { GAME_CONSTANTS } from '@scribblitz/shared';

interface LobbyScreenProps {
  roomCode: string;
  players: Player[];
  config: RoomConfig;
  isHost: boolean;
  hostId: string;
  onUpdateConfig: (newConfig: Partial<RoomConfig>) => void;
  onStartGame: () => void;
  onRequestLeave: () => void;
}

// Framer Motion variants for the staggered list
const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }, // Animates each player in one by one!
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, x: -30, scale: 0.95 },
  show: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 250, damping: 25 },
  },
  exit: {
    opacity: 0,
    scale: 0.9,
    transition: { duration: 0.3, ease: 'easeInOut' },
  },
};

export const LobbyScreen = ({
  roomCode,
  players,
  config,
  isHost,
  hostId,
  onUpdateConfig,
  onStartGame,
  onRequestLeave,
}: LobbyScreenProps) => {
  // Track when the user copies the code
  const [copied, setCopied] = useState(false);

  // Mobile Tab State (Defaults to players so host sees friends join immediately)
  const [activeTab, setActiveTab] = useState<'settings' | 'players'>('players');

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Extracted the Action UI so we can render it in the sticky bar on mobile, and the normal column on desktop
  const renderActionUI = () => (
    <>
      {isHost ? (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.95 }}
          onClick={onStartGame}
          className="w-full bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white py-4 md:py-5 rounded-2xl font-black text-xl md:text-2xl border-b-[6px] border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1.5 transition-all shadow-lg"
        >
          START GAME
        </motion.button>
      ) : (
        // The Active Waiting State
        <div className="w-full bg-blue-50/50 dark:bg-neon-blue/10 py-4 md:py-5 rounded-2xl border-2 border-blue-200 dark:border-neon-blue/30 flex justify-center items-center gap-3 relative overflow-hidden shadow-[inset_0px_0px_20px_rgba(0,191,255,0.1)]">
          {/* Soft pulsing background glow */}
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-linear-to-r from-transparent via-blue-100/50 dark:via-neon-blue/10 to-transparent"
          />

          {/* Spinning loader & Text */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="relative z-10 text-blue-500 dark:text-neon-blue"
          >
            <Settings2 size={24} strokeWidth={2.5} />
          </motion.div>

          <span className="relative z-10 font-black text-lg text-blue-700 dark:text-neon-blue tracking-wide">
            Waiting for Host...
          </span>
        </div>
      )}
    </>
  );

  return (
    // 🌟 FIX: Changed layout to flex-col (Mobile) and flex-row (Desktop).
    // 🌟 FIX: overflow-hidden ensures the white card keeps its beautiful rounded corners, while the contents inside scroll!
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="w-full max-w-5xl flex flex-col md:flex-row gap-6 bg-white dark:bg-discord-card p-4 md:p-6 rounded-[2rem] md:rounded-[2.5rem] border-4 border-gray-200 dark:border-discord-main shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] flex-1 min-h-0 overflow-hidden"
    >
      {/* MOBILE TAB SWITCHER */}
      <div className="flex md:hidden bg-gray-100 dark:bg-discord-main p-1.5 rounded-2xl border-2 border-gray-200 dark:border-gray-800 shrink-0">
        <button
          onClick={() => setActiveTab('settings')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black text-sm rounded-xl transition-all ${
            activeTab === 'settings'
              ? 'bg-white dark:bg-discord-card shadow-sm text-blue-600 dark:text-neon-blue border-2 border-gray-200 dark:border-gray-700'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border-2 border-transparent'
          }`}
        >
          <Settings2 size={16} strokeWidth={2.5} /> Settings
        </button>
        <button
          onClick={() => setActiveTab('players')}
          className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black text-sm rounded-xl transition-all ${
            activeTab === 'players'
              ? 'bg-white dark:bg-discord-card shadow-sm text-purple-600 dark:text-neon-pink border-2 border-gray-200 dark:border-gray-700'
              : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border-2 border-transparent'
          }`}
        >
          <Users size={16} strokeWidth={2.5} /> Players ({players.length})
        </button>
      </div>

      {/* LEFT COLUMN: SETTINGS */}
      <div
        className={`flex-1 flex-col gap-6 overflow-y-auto custom-scrollbar md:pr-2 ${activeTab === 'settings' ? 'flex' : 'hidden md:flex'}`}
      >
        <div className="flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2.5 md:p-3 bg-blue-100 dark:bg-neon-blue/20 rounded-2xl text-blue-600 dark:text-neon-blue">
              <Settings2 size={24} className="md:w-7 md:h-7" strokeWidth={2.5} />
            </div>
            <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
              Configuration
            </h2>
          </div>
          <button
            onClick={onRequestLeave}
            className="flex items-center gap-2 text-red-500 dark:text-neon-pink text-xs md:text-sm font-bold border-2 border-red-200 dark:border-neon-pink-border bg-red-50 dark:bg-neon-pink/10 px-3 py-1.5 md:px-4 md:py-2 rounded-xl hover:bg-red-100 dark:hover:bg-neon-pink/20 transition-colors shrink-0"
          >
            <LogOut size={16} strokeWidth={3} />
            <span className="hidden sm:inline">Leave</span>
          </button>
        </div>

        <div className="flex flex-col gap-6 bg-gray-50 dark:bg-discord-main p-5 md:p-6 rounded-3xl border-2 border-gray-100 dark:border-discord-main shrink-0">
          {/* Rounds Slider */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center font-black text-gray-700 dark:text-gray-200">
              <label>Total Rounds</label>
              <span className="bg-white dark:bg-discord-card px-3 py-1 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                {config.roundCount || GAME_CONSTANTS.DEFAULT_ROUND_COUNT}
              </span>
            </div>
            <input
              type="range"
              min={GAME_CONSTANTS.MINIMUM_ROUND_COUNT}
              max={GAME_CONSTANTS.MAXIMUM_ROUND_COUNT}
              value={config.roundCount || GAME_CONSTANTS.DEFAULT_ROUND_COUNT}
              onChange={(e) => onUpdateConfig({ roundCount: parseInt(e.target.value) })}
              disabled={!isHost}
              className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${isHost ? 'bg-blue-200 dark:bg-gray-700 accent-blue-500 dark:accent-neon-blue' : 'bg-gray-200 dark:bg-gray-800 opacity-50 cursor-not-allowed'}`}
            />
          </div>

          {/* Draw Time Slider */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center font-black text-gray-700 dark:text-gray-200">
              <label>Draw Time</label>
              <span className="bg-white dark:bg-discord-card px-3 py-1 rounded-lg border-2 border-gray-200 dark:border-gray-700 shadow-sm">
                {config.drawTimeSeconds || GAME_CONSTANTS.DEFAULT_DRAW_TIME_SECONDS}s
              </span>
            </div>
            <input
              type="range"
              min={GAME_CONSTANTS.MINIMUM_DRAW_TIME_SECONDS}
              max={GAME_CONSTANTS.MAXIMUM_DRAW_TIME_SECONDS}
              step="10"
              value={config.drawTimeSeconds || GAME_CONSTANTS.DEFAULT_DRAW_TIME_SECONDS}
              onChange={(e) => onUpdateConfig({ drawTimeSeconds: parseInt(e.target.value) })}
              disabled={!isHost}
              className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${isHost ? 'bg-blue-200 dark:bg-gray-700 accent-blue-500 dark:accent-neon-blue' : 'bg-gray-200 dark:bg-gray-800 opacity-50 cursor-not-allowed'}`}
            />
          </div>
        </div>

        {/* START GAME / WAITING UI FOR NON-HOSTS (DESKTOP ONLY) */}
        <div className="hidden md:block mt-auto pt-4 shrink-0">{renderActionUI()}</div>
      </div>

      {/* RIGHT COLUMN: PLAYERS */}
      <div
        className={`flex-1 flex-col bg-gray-50 dark:bg-discord-main p-4 md:p-6 rounded-3xl border-2 border-gray-100 dark:border-discord-main overflow-hidden ${activeTab === 'players' ? 'flex' : 'hidden md:flex'}`}
      >
        {/* 🌟 FIX: Added flex-wrap so the ROOM CODE button drops down cleanly on small phones instead of smushing! */}
        <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 pb-4 border-b-2 border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 md:p-2.5 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
              <Users size={20} className="md:w-6 md:h-6" strokeWidth={2.5} />
            </div>
            <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
              Players
            </h2>
          </div>
          <button
            onClick={handleCopyCode}
            className="bg-white dark:bg-discord-card text-gray-800 dark:text-gray-200 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-black tracking-widest border-2 border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-[#383A40] transition-colors active:scale-95 shrink-0"
            title="Copy Room Code"
          >
            ROOM <span className="text-purple-600 dark:text-neon-pink">{roomCode}</span>
            {copied ? (
              <Check size={14} className="text-green-500 md:w-4 md:h-4" strokeWidth={3} />
            ) : (
              <Copy
                size={14}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors md:w-4 md:h-4"
                strokeWidth={2.5}
              />
            )}
          </button>
        </div>

        {/* 🌟 FIX: Mobile Grid System! grid-cols-2 on small phones, 3 on larger phones, vertical list on desktop */}
        <motion.div
          variants={listVariants}
          initial="hidden"
          animate="show"
          className="grid grid-cols-2 min-[400px]:grid-cols-3 md:flex md:flex-col gap-3 mt-4 overflow-y-auto custom-scrollbar pr-1 md:pr-2 pb-2"
        >
          <AnimatePresence mode="popLayout">
            {players.map((p) => (
              <motion.div
                key={p.id}
                variants={itemVariants}
                initial="hidden"
                animate="show"
                exit="exit"
                layout
                // 🌟 FIX: Stacked columns for grid tiles on mobile, side-by-side flex for desktop list
                className={`p-2.5 md:p-3 bg-white dark:bg-discord-card rounded-2xl border-2 ${!p.isConnected ? 'border-red-300 dark:border-red-900/50 opacity-60' : 'border-gray-100 dark:border-gray-800'} flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-4 shadow-sm relative overflow-hidden`}
              >
                {/* DICEBEAR AVATAR INJECTION */}
                <div className="relative w-12 h-12 md:w-12 md:h-12 shrink-0 overflow-hidden rounded-full shadow-inner bg-gray-100 dark:bg-discord-main">
                  <Image
                    src={`https://api.dicebear.com/10.x/micah/svg?seed=${p.avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f2c2e0,b4e2b9,ffeab6&radius=50&glassesProbability=30&facialHairProbability=20&earringsProbability=30`}
                    alt={p.username}
                    fill
                    sizes="48px"
                    unoptimized
                    className="object-cover"
                  />
                  {!p.isConnected && (
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 z-10 bg-red-500 rounded-full border-2 border-white dark:border-discord-card animate-pulse" />
                  )}
                </div>

                <div className="flex flex-col w-full truncate items-center md:items-start text-center md:text-left">
                  <span
                    className={`font-black text-sm md:text-lg truncate w-full ${!p.isConnected ? 'text-gray-400 dark:text-gray-500' : 'text-gray-800 dark:text-gray-100'}`}
                  >
                    {p.username}
                  </span>
                  {!p.isConnected && (
                    <span className="text-red-500 dark:text-red-400 text-[10px] md:text-xs font-bold truncate w-full">
                      Connection Lost...
                    </span>
                  )}
                </div>

                {p.id === hostId && (
                  <motion.div
                    animate={{ y: [-2, 2, -2] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    // 🌟 FIX: Absolute positioning for mobile grid, floating to the right for desktop list
                    className="absolute top-2 right-2 md:relative md:top-auto md:right-auto shrink-0 bg-linear-to-br from-yellow-200 to-yellow-400 dark:from-yellow-500/20 dark:to-yellow-700/40 border-2 border-yellow-300 dark:border-yellow-600/50 p-1 md:p-2 rounded-lg md:rounded-xl shadow-[0_0_15px_rgba(250,204,21,0.4)]"
                    title="Room Host"
                  >
                    <Crown
                      size={14}
                      className="md:w-5 md:h-5 text-yellow-700 dark:text-yellow-400"
                      fill="currentColor"
                      strokeWidth={2}
                    />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </div>

      {/* 🌟 FIX: NATIVELY EMBEDDED MOBILE ACTION BAR */}
      <div className="md:hidden shrink-0 pt-3 border-t-2 border-gray-100 dark:border-gray-800 mt-auto">
        {renderActionUI()}
      </div>
    </motion.div>
  );
};
