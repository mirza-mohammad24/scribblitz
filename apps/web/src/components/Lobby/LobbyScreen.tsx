'use client';

/**
 * @module LobbyScreen
 * @description The pre-game lobby where the host configures game settings
 * (rounds, draw time, difficulty, custom words / strict mode) and all players
 * wait before the game starts. Displays a player roster with DiceBear avatars,
 * a copyable room code, and responsive mobile/desktop layouts with tab switching.
 */

import { useState } from 'react';
import { motion, AnimatePresence, Variants } from 'framer-motion';
import { Player, RoomConfig } from '@scribblitz/types';
import {
  Crown,
  Users,
  Settings2,
  LogOut,
  Copy,
  Check,
  Info,
  BookOpen,
  Bot,
  Sparkles,
} from 'lucide-react';
import Image from 'next/image';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { CustomWordsDrawer } from './CustomWordsDrawer';
import { StrictModeWarningOverlay } from '../ui/StrictModeWarningOverlay';

interface LobbyScreenProps {
  roomCode: string;
  players: Player[];
  config: RoomConfig;
  isHost: boolean;
  hostId: string;
  isGeneratingThemedWords: boolean; //Indicates if the AI theme-based word generation is currently in progress
  onUpdateConfig: (newConfig: Partial<RoomConfig>) => void;
  onStartGame: () => void;
  onRequestLeave: () => void;
  onGenerateTheme: (theme: string) => void; //Callback for generating a themed word list
}

// Framer Motion variants for the staggered list
const listVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }, // Animates each player in one by one
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
  isGeneratingThemedWords,
  onUpdateConfig,
  onStartGame,
  onRequestLeave,
  onGenerateTheme,
}: LobbyScreenProps) => {
  // Track when the user copies the code
  const [copied, setCopied] = useState(false);

  // Mobile Tab State (Defaults to players so host sees friends join immediately)
  const [activeTab, setActiveTab] = useState<'settings' | 'players'>('players');

  // Modular Overlay State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isWarningOpen, setIsWarningOpen] = useState(false);

  // State to strictly track which tooltip is active (helps to guarantee only one tip is active at a time)
  const [activeTooltip, setActiveTooltip] = useState<'rounds' | 'drawTime' | 'difficulty' | null>(
    null,
  );

  /**
   * Copies the room code to the system clipboard and shows a temporary
   * "copied" confirmation state that resets after 2 seconds.
   * @returns {void}
   */
  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  /**
   * Validates that strict mode has a sufficient number of custom words before
   * starting the game. If the custom word count is below the minimum required
   * (round count + buffer), opens the {@link StrictModeWarningOverlay} instead.
   * Otherwise invokes the {@link LobbyScreenProps.onStartGame} callback directly.
   * @returns {void}
   */
  const handleStartGameClick = () => {
    if (config.customWordsOnly) {
      const minRequired =
        (config.roundCount || GAME_CONSTANTS.DEFAULT_ROUND_COUNT) +
        GAME_CONSTANTS.CUSTOM_WORD_BUFFER;
      const customCount = config.customWordList?.length ?? config.customWordCount ?? 0;

      if (customCount < minRequired) {
        setIsWarningOpen(true);
        return;
      }
    }
    onStartGame();
  };

  // Extracted the Action UI so we can render it in the sticky bar on mobile, and the normal column on desktop
  /**
   * Renders the contextual action button: a "START GAME" button for the host,
   * or an animated "Waiting for Host..." indicator for non-host players.
   * Shared between the mobile sticky bar and the desktop settings column.
   * @returns {React.JSX.Element} The action UI fragment.
   */
  const renderActionUI = () => (
    <>
      {isHost ? (
        <motion.button
          whileTap={{ scale: isGeneratingThemedWords ? 1 : 0.95 }}
          onClick={handleStartGameClick}
          disabled={isGeneratingThemedWords}
          className={`w-full py-4 md:py-5 rounded-2xl font-black text-xl md:text-2xl border-b-[6px] transition-all shadow-lg flex justify-center items-center gap-3
            ${
              isGeneratingThemedWords
                ? 'bg-gray-400 dark:bg-gray-700 text-gray-200 border-gray-500 dark:border-gray-800 cursor-not-allowed translate-y-1.5 border-b-0'
                : 'bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1.5'
            }`}
        >
          {isGeneratingThemedWords ? (
            <>
              <motion.div
                animate={{
                  y: [0, -2, 0],
                  rotate: [-2, 2, -2],
                }}
                transition={{
                  duration: 1.2,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Bot size={24} strokeWidth={2.5} />
              </motion.div>
              Cooking Up Words...
            </>
          ) : (
            'START GAME'
          )}
        </motion.button>
      ) : (
        // The Active Waiting State
        <div className="w-full bg-green-50/50 dark:bg-neon-blue/10 py-4 md:py-5 rounded-2xl border-2 border-green-200 dark:border-neon-blue/30 flex justify-center items-center gap-3 relative overflow-hidden shadow-[inset_0px_0px_20px_rgba(0,191,255,0.1)]">
          {/* Soft pulsing background glow */}
          <motion.div
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute inset-0 bg-linear-to-r from-transparent via-green-100/50 dark:via-neon-blue/10 to-transparent"
          />

          {/* Spinning loader & Text */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
            className="relative z-10 text-green-500 dark:text-neon-blue"
          >
            <Settings2 size={24} strokeWidth={2.5} />
          </motion.div>

          <span className="relative z-10 font-black text-lg text-green-700 dark:text-neon-blue tracking-wide">
            Waiting for Host...
          </span>
        </div>
      )}
    </>
  );

  return (
    // Changed layout to flex-col (Mobile) and flex-row (Desktop).
    // overflow-hidden ensures the white card keeps its beautiful rounded corners, while the contents inside scroll
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="w-full max-w-5xl flex flex-col md:flex-row gap-6 bg-white dark:bg-discord-card p-4 md:p-6 rounded-4xl md:rounded-[2.5rem] border-4 border-gray-200 dark:border-discord-main shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.5)] flex-1 min-h-0 overflow-hidden"
      >
        {/* MOBILE TAB SWITCHER */}
        <div className="flex md:hidden bg-gray-100 dark:bg-discord-main p-1.5 rounded-2xl border-2 border-gray-200 dark:border-gray-800 shrink-0">
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black text-sm rounded-xl transition-all ${
              activeTab === 'settings'
                ? 'bg-white dark:bg-discord-card shadow-sm text-red-600 dark:text-neon-pink border-2 border-gray-200 dark:border-gray-700'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 border-2 border-transparent'
            }`}
          >
            <Settings2 size={16} strokeWidth={2.5} /> Settings
          </button>
          <button
            onClick={() => setActiveTab('players')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 font-black text-sm rounded-xl transition-all ${
              activeTab === 'players'
                ? 'bg-white dark:bg-discord-card shadow-sm text-red-600 dark:text-neon-pink border-2 border-gray-200 dark:border-gray-700'
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
              <div className="p-2.5 md:p-3 bg-green-100 dark:bg-neon-blue/20 rounded-2xl text-green-600 dark:text-neon-blue">
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
            <div
              className={`flex flex-col gap-3 relative transition-all duration-200 ${activeTooltip === 'rounds' ? 'z-50' : 'z-10'}`}
            >
              <div className="flex justify-between items-center font-black text-gray-700 dark:text-gray-200">
                {/* LABEL & INFO ICON WRAPPER */}
                <div className="flex items-center gap-2">
                  <label>Total Rounds</label>

                  {/* TOOLTIP WRAPPER: group classes handle both desktop hover and mobile tap (focus) */}
                  <div
                    className="relative flex items-center"
                    onMouseEnter={() => setActiveTooltip('rounds')}
                    onMouseLeave={() => setActiveTooltip(null)}
                  >
                    <button
                      type="button"
                      tabIndex={0}
                      onClick={(e) => e.preventDefault()}
                      onFocus={() => setActiveTooltip('rounds')}
                      onBlur={() => setActiveTooltip(null)}
                      className="text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-neon-blue transition-colors outline-none focus:outline-none cursor-pointer"
                      aria-label="Round Math Information"
                    >
                      <Info size={16} strokeWidth={3} />
                    </button>

                    {/* THE TOOLTIP OVERLAY */}
                    <div
                      className={`absolute left-0 top-full mt-2 w-60 sm:w-64 max-w-[85vw]
                     bg-gray-900 dark:bg-[#111214]
                      text-gray-300 
                      p-3.5 
                      rounded-xl 
                      shadow-2xl 
                      z-50 
                      text-xs 
                      font-bold 
                      transition-all duration-200
                      pointer-events-none
                      ${
                        activeTooltip === 'rounds'
                          ? 'opacity-100 visible translate-y-0'
                          : 'opacity-0 invisible -translate-y-1'
                      }`}
                    >
                      {/* Tooltip Triangle Pointer */}
                      <div className="absolute -top-1 left-1.5 w-3 h-3 bg-gray-900 dark:bg-[#111214] rotate-45 rounded-sm" />

                      <div className="text-green-400 dark:text-neon-blue font-black flex items-center gap-1.5 uppercase tracking-wider text-[10px] mb-1.5 border-b border-gray-700 pb-1.5">
                        Rule: 1 Round = 1 Player&apos;s Turn to Draw!
                      </div>

                      {(() => {
                        const connectedPlayers = players.filter((p) => p.isConnected);
                        const playerCount = connectedPlayers.length;
                        const rounds = config.roundCount || GAME_CONSTANTS.DEFAULT_ROUND_COUNT;

                        if (playerCount === 0)
                          return <span className="text-gray-500">Waiting for players...</span>;

                        const baseDraws = Math.floor(rounds / playerCount);
                        const extraDrawers = rounds % playerCount;

                        let description = '';
                        if (rounds <= playerCount) {
                          description = `${rounds} ${rounds === 1 ? 'person draws' : 'people draw'} once`;
                          const nonDrawersCount = playerCount - rounds;
                          if (nonDrawersCount > 0) {
                            description += `, ${nonDrawersCount} ${nonDrawersCount === 1 ? "doesn't" : "don't"}.`;
                          } else {
                            description += '.';
                          }
                        } else {
                          description = `Everyone draws ${baseDraws} ${baseDraws === 1 ? 'time' : 'times'}`;
                          if (extraDrawers > 0) {
                            description += `, and ${extraDrawers} ${extraDrawers === 1 ? 'person draws' : 'people draw'} an extra time.`;
                          } else {
                            description += '.';
                          }
                        }

                        return (
                          <span className="leading-relaxed block">
                            <span className="text-white">
                              {rounds} {rounds === 1 ? 'Round' : 'Rounds'}
                            </span>
                            ,{' '}
                            <span className="text-white">
                              {playerCount} {playerCount === 1 ? 'Player' : 'Players'}
                            </span>
                            <br />
                            <span className="text-gray-400 mt-1 block">→ {description}</span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

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
                className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${isHost ? 'bg-green-200 dark:bg-gray-700 accent-green-500 dark:accent-neon-blue' : 'bg-gray-200 dark:bg-gray-800 opacity-50 cursor-not-allowed'}`}
              />
            </div>

            {/* Draw Time Slider */}
            <div
              className={`flex flex-col gap-3 relative transition-all duration-200 ${activeTooltip === 'drawTime' ? 'z-50' : 'z-10'}`}
            >
              <div className="flex justify-between items-center font-black text-gray-700 dark:text-gray-200">
                <div className="flex items-center gap-2">
                  <label>Draw Time</label>

                  <div
                    className="relative flex items-center"
                    onMouseEnter={() => setActiveTooltip('drawTime')}
                    onMouseLeave={() => setActiveTooltip(null)}
                  >
                    <button
                      type="button"
                      tabIndex={0}
                      onFocus={() => setActiveTooltip('drawTime')}
                      onBlur={() => setActiveTooltip(null)}
                      onClick={(e) => e.preventDefault()}
                      className="text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-neon-blue transition-colors outline-none focus:outline-none cursor-pointer"
                      aria-label="Draw Time Information"
                    >
                      <Info size={16} strokeWidth={3} />
                    </button>

                    {/* Tooltip - Total Duration Math */}
                    <div
                      className={`absolute left-0 top-full mt-2 w-60 sm:w-64 max-w-[85vw]
                     bg-gray-900 dark:bg-[#111214]
                      text-gray-300 
                      p-3.5 
                      rounded-xl 
                      shadow-2xl 
                      z-50 
                      text-xs 
                      font-bold 
                      transition-all duration-200
                      pointer-events-none
                      ${
                        activeTooltip === 'drawTime'
                          ? 'opacity-100 visible translate-y-0'
                          : 'opacity-0 invisible -translate-y-1'
                      }`}
                    >
                      <div className="absolute -top-1 left-1.5 w-3 h-3 bg-gray-900 dark:bg-[#111214] rotate-45 rounded-sm" />

                      <div className="text-green-400 dark:text-neon-blue font-black flex items-center gap-1.5 uppercase tracking-wider text-[10px] mb-1.5 border-b border-gray-700 pb-1.5">
                        Estimated Game Time
                      </div>

                      {(() => {
                        const rounds = config.roundCount || GAME_CONSTANTS.DEFAULT_ROUND_COUNT;
                        const drawTime =
                          config.drawTimeSeconds || GAME_CONSTANTS.DEFAULT_DRAW_TIME_SECONDS;

                        // Draw time + 15s Selection Time + 5s Round End Display
                        const roundBuffer =
                          GAME_CONSTANTS.WORD_SELECTION_TIMEOUT_SECONDS +
                          GAME_CONSTANTS.ROUND_END_DISPLAY_SECONDS;
                        const totalSeconds = rounds * (drawTime + roundBuffer);
                        const totalMinutes = Math.ceil(totalSeconds / 60);

                        let message = 'A quick sprint!';
                        if (totalMinutes > 45) message = 'A marathon of pure chaos!';
                        else if (totalMinutes > 20)
                          message = 'Settle in, things are getting serious.';
                        else if (totalMinutes > 10) message = 'A perfect session of scribbling.';

                        return (
                          <span className="leading-relaxed block">
                            About <span className="text-white">~{totalMinutes} minutes</span> total.
                            <br />
                            <span className="text-gray-400 mt-1 block">→ {message}</span>
                            <span className="text-[9px] text-gray-600 dark:text-gray-500 mt-2 block font-medium">
                              (Includes drawing, selection & results)
                            </span>
                          </span>
                        );
                      })()}
                    </div>
                  </div>
                </div>

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
                className={`w-full h-3 rounded-lg appearance-none cursor-pointer ${isHost ? 'bg-green-200 dark:bg-gray-700 accent-green-500 dark:accent-neon-blue' : 'bg-gray-200 dark:bg-gray-800 opacity-50 cursor-not-allowed'}`}
              />
            </div>

            {/* Difficulty Selector */}
            <div
              className={`flex flex-col gap-3 relative transition-all duration-200 ${activeTooltip === 'difficulty' ? 'z-50' : 'z-10'}`}
            >
              {/* LABEL & INFO ICON WRAPPER */}
              <div className="flex items-center gap-2 font-black text-gray-700 dark:text-gray-200">
                <label>Difficulty</label>

                <div
                  className="relative flex items-center"
                  onMouseEnter={() => setActiveTooltip('difficulty')}
                  onMouseLeave={() => setActiveTooltip(null)}
                >
                  <button
                    type="button"
                    tabIndex={0}
                    onFocus={() => setActiveTooltip('difficulty')}
                    onBlur={() => setActiveTooltip(null)}
                    onClick={(e) => e.preventDefault()}
                    className="text-gray-400 dark:text-gray-500 hover:text-green-500 dark:hover:text-neon-blue transition-colors outline-none focus:outline-none cursor-pointer"
                    aria-label="Difficulty Information"
                  >
                    <Info size={16} strokeWidth={3} />
                  </button>

                  {/* THE TOOLTIP OVERLAY */}
                  <div
                    className={`absolute left-0 top-full mt-2 w-60 sm:w-64 max-w-[85vw]
                    bg-gray-900 dark:bg-[#111214]
                    text-gray-300
                    p-3.5
                    rounded-xl
                    shadow-2xl
                    z-50
                    text-xs
                    font-bold
                    transition-all duration-200
                    pointer-events-none
                    ${
                      activeTooltip === 'difficulty'
                        ? 'opacity-100 visible translate-y-0'
                        : 'opacity-0 invisible -translate-y-1'
                    }`}
                  >
                    <div className="absolute -top-1 left-1.5 w-3 h-3 bg-gray-900 dark:bg-[#111214] rotate-45 rounded-sm" />

                    <div className="text-green-400 dark:text-neon-blue font-black flex items-center gap-1.5 uppercase tracking-wider text-[10px] mb-1.5 border-b border-gray-700 pb-1.5">
                      Hint Reveal Limits
                    </div>

                    <span className="leading-relaxed block">
                      Controls how many letters the automatic hints will uncover:
                      <br />
                      <span className="text-gray-400 mt-1.5 block leading-loose">
                        <span className="text-green-400 font-black px-1 bg-green-400/10 rounded-md">
                          Easy
                        </span>{' '}
                        ~50% of the word
                        <br />
                        <span className="text-yellow-400 font-black px-1 bg-yellow-400/10 rounded-md">
                          Medium
                        </span>{' '}
                        ~30% of the word
                        <br />
                        <span className="text-red-400 font-black px-1 bg-red-400/10 rounded-md">
                          Hard
                        </span>{' '}
                        ~15% of the word
                      </span>
                      <span className="text-[9px] text-gray-600 dark:text-gray-500 mt-2 block font-medium">
                        (Shorter words mathematically reveal fewer letters)
                      </span>
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                {(['easy', 'medium', 'hard'] as const).map((level) => {
                  const currentDifficulty = config.difficulty || GAME_CONSTANTS.DEFAULT_DIFFICULTY;
                  return (
                    <button
                      key={level}
                      onClick={() => isHost && onUpdateConfig({ difficulty: level })}
                      disabled={!isHost}
                      className={`flex-1 py-2.5 rounded-xl font-black text-sm capitalize border-2 transition-all
                        ${
                          currentDifficulty === level
                            ? level === 'easy'
                              ? 'bg-green-100 dark:bg-green-900/30 border-green-500 dark:border-green-400 text-green-700 dark:text-green-400'
                              : level === 'medium'
                                ? 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-500 dark:border-yellow-400 text-yellow-700 dark:text-yellow-400'
                                : 'bg-red-100 dark:bg-red-900/30 border-red-500 dark:border-red-400 text-red-700 dark:text-red-400'
                            : 'bg-gray-100 dark:bg-discord-main border-gray-200 dark:border-gray-700 text-gray-500 dark:text-gray-400'
                        }
                        ${!isHost ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:opacity-90 active:scale-95'}
                      `}
                    >
                      {level}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Custom Words Button Trigger & Strict Mode Toggle  */}
          <div className="flex flex-col gap-3 mt-2 border-t-2 border-gray-200 dark:border-gray-800 pt-5">
            <button
              onClick={() => setIsDrawerOpen(true)}
              disabled={!isHost}
              className={`w-full py-3.5 px-4 rounded-xl flex items-center justify-between font-black text-sm border-2 transition-all ${
                isHost
                  ? 'bg-white dark:bg-discord-card border-gray-300 dark:border-gray-700 hover:border-green-400 dark:hover:border-neon-blue text-gray-700 dark:text-gray-200 hover:shadow-sm active:scale-[0.98]'
                  : 'bg-gray-100 dark:bg-discord-main border-gray-200 dark:border-gray-800 text-gray-400 opacity-70 cursor-not-allowed'
              }`}
            >
              <div className="flex items-center gap-2">
                <BookOpen size={18} className="text-green-500 dark:text-neon-blue" />
                <span>Custom Words</span>
                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-red-100 dark:bg-neon-pink/20 text-red-600 dark:text-neon-pink border border-red-200 dark:border-neon-pink/30 text-[9px] font-black uppercase tracking-wider ml-1">
                  <Sparkles size={10} strokeWidth={3} />
                  Powered by AI
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-discord-main px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700">
                  {config.customWordList?.length ?? config.customWordCount ?? 0} Added
                </span>
              </div>
            </button>

            <div className="flex items-center justify-between pl-2">
              <div className="flex flex-col">
                <span className="font-black text-gray-700 dark:text-gray-200 text-sm">
                  Strict Mode
                </span>
                <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold">
                  Forbid all default game words and play with only custom words.
                </span>
              </div>

              <button
                onClick={() =>
                  isHost && onUpdateConfig({ customWordsOnly: !config.customWordsOnly })
                }
                disabled={!isHost}
                className={`relative w-12 h-7 rounded-full transition-colors border-2 ${
                  config.customWordsOnly
                    ? 'bg-green-500 dark:bg-neon-blue border-green-600 dark:border-blue-900'
                    : 'bg-gray-200 dark:bg-gray-700 border-gray-300 dark:border-gray-600'
                } ${!isHost ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <motion.div
                  animate={{ x: config.customWordsOnly ? 20 : 2 }}
                  className="absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm"
                />
              </button>
            </div>
          </div>

          {/* START GAME / WAITING UI FOR NON-HOSTS (DESKTOP ONLY) */}
          <div className="hidden md:block mt-auto pt-4 pb-1 shrink-0">{renderActionUI()}</div>
        </div>

        {/* RIGHT COLUMN: PLAYERS */}
        <div
          className={`flex-1 flex-col bg-gray-50 dark:bg-discord-main p-4 md:p-6 rounded-3xl border-2 border-gray-100 dark:border-discord-main overflow-hidden min-h-0 ${activeTab === 'players' ? 'flex' : 'hidden md:flex'}`}
        >
          {/* Added flex-wrap so the ROOM CODE button drops down cleanly on small phones instead of smushing */}
          <div className="flex flex-wrap sm:flex-nowrap justify-between items-center gap-3 pb-4 border-b-2 border-gray-200 dark:border-gray-800 shrink-0">
            <div className="flex items-center gap-3">
              <div className="p-2 md:p-2.5 bg-red-100 dark:bg-neon-pink/20 rounded-xl text-purple-600 dark:text-purple-400 shrink-0">
                <Users size={20} className="md:w-6 md:h-6" strokeWidth={2.5} />
              </div>
              <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
                Players
              </h2>
            </div>
            <button
              onClick={handleCopyCode}
              className="bg-white dark:bg-discord-card text-gray-800 dark:text-gray-200 px-3 py-1.5 md:px-4 md:py-2 rounded-full text-xs md:text-sm font-black tracking-widest border-2 border-gray-200 dark:border-gray-700 shadow-sm flex items-center justify-center gap-2 hover:border-red-200 dark:hover:border-neon-pink/30 hover:bg-gray-50 dark:hover:bg-[#383A40] transition-colors active:scale-95 shrink-0 group"
              title="Copy Room Code"
            >
              ROOM <span className="text-red-600 dark:text-neon-pink">{roomCode}</span>
              {copied ? (
                <Check size={14} className="text-green-500 md:w-4 md:h-4" strokeWidth={3} />
              ) : (
                <Copy
                  size={14}
                  className="text-gray-400 group-hover:text-red-500 dark:group-hover:text-neon-pink transition-colors md:w-4 md:h-4"
                  strokeWidth={2.5}
                />
              )}
            </button>
          </div>

          {/* Mobile Grid System; grid-cols-2 on small phones, 3 on larger phones, vertical list on desktop */}
          <motion.div
            variants={listVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-2 min-[400px]:grid-cols-3 md:flex md:flex-col gap-3 mt-4 overflow-y-auto custom-scrollbar pr-1 md:pr-2 pb-2 flex-1 min-h-0 content-start"
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
                  //  Stacked columns for grid tiles on mobile, side-by-side flex for desktop list
                  className={`p-2.5 md:p-3 bg-white dark:bg-discord-card rounded-2xl border-2 ${!p.isConnected ? 'border-red-300 dark:border-red-900/50 opacity-60' : 'border-gray-100 dark:border-gray-800'} flex flex-col md:flex-row items-center justify-center md:justify-start gap-2 md:gap-4 shadow-sm relative overflow-hidden shrink-0 min-h-26.25 md:min-h-0 md:h-auto`}
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
                      //Absolute positioning for mobile grid, floating to the right for desktop list
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

        {/* NATIVELY EMBEDDED MOBILE ACTION BAR */}
        <div className="md:hidden shrink-0 pt-3 pb-1 border-t-2 border-gray-100 dark:border-gray-800 mt-auto">
          {renderActionUI()}
        </div>
      </motion.div>

      <CustomWordsDrawer
        isOpen={isDrawerOpen}
        initialWords={config.customWordList || []}
        isGenerating={isGeneratingThemedWords}
        onGenerateTheme={onGenerateTheme}
        onClose={() => setIsDrawerOpen(false)}
        onSave={(words) => {
          onUpdateConfig({ customWordList: words });
          setIsDrawerOpen(false);
        }}
      />

      <StrictModeWarningOverlay
        isOpen={isWarningOpen}
        customWordCount={config.customWordList?.length ?? config.customWordCount ?? 0}
        minRequired={
          (config.roundCount || GAME_CONSTANTS.DEFAULT_ROUND_COUNT) +
          GAME_CONSTANTS.CUSTOM_WORD_BUFFER
        }
        onAddMoreWords={() => {
          setIsWarningOpen(false);
          setIsDrawerOpen(true);
        }}
        onTurnOffStrictModeAndStart={() => {
          onUpdateConfig({ customWordsOnly: false });
          setIsWarningOpen(false);
          onStartGame();
        }}
        onStartAnyway={() => {
          setIsWarningOpen(false);
          onStartGame();
        }}
      />
    </>
  );
};
