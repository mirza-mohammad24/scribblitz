'use client';

/**
 * @file ArenaHUD.tsx — Heads-Up Display bar rendered above the game arena.
 *
 * Displays at-a-glance game metadata across three columns:
 *
 * - Left column: Current round number and a mobile-only toggle to expand
 *   the player list.
 * - Center column: The active drawer's username and an animated word hint
 *   that transitions on every hint update. A superscript shows the word length.
 * - Right column: A countdown timer (via {@link HUDTimer}) and a quit button.
 *
 * The timer uses {@link useSyncedTimer} for server-authoritative countdown and
 * triggers a pulsing red "danger" animation when <= 10 seconds remain.
 *
 * @see {@link ArenaOrchestrator} — parent that renders this component
 * @see {@link useSyncedTimer} — hook providing the server-synced countdown
 */

import { useGameStore } from '@/store/gameStore';
import { GameState } from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { Clock, Edit2, LogOut, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSyncedTimer } from '@/hooks/useSyncedTimer';

interface ArenaHUDProps {
  /** Callback invoked when the user clicks the quit / leave button. */
  onRequestLeave: () => void;
  /** Callback to toggle the mobile player list dropdown. */
  onToggleMobilePlayers: () => void;
  /** The current user's ID, used to determine if they are the drawer. */
  userId: string | null;
}

/**
 * Animated countdown timer for the drawing phase.
 *
 * Uses {@link useSyncedTimer} to derive the seconds remaining from the
 * server-authoritative round start time. When ≤ 10 seconds remain the
 * text turns red and a looping scale pulse animation is applied via
 * Framer Motion.
 *
 * @param props.duration - The total round duration in seconds (from room config).
 * @returns An animated `<span>` showing the remaining seconds.
 */
const HUDTimer = ({ duration }: { duration: number }) => {
  const { localPhaseEndTime } = useGameStore();

  const { timeLeft } = useSyncedTimer(localPhaseEndTime, duration);
  const isDangerTime = timeLeft <= 10;

  return (
    <motion.span
      animate={isDangerTime ? { scale: [1, 1.15, 1] } : { scale: 1 }}
      transition={isDangerTime ? { repeat: Infinity, duration: 1 } : {}}
      className={`text-xl md:text-2xl font-black tabular-nums transition-colors duration-300 ${
        isDangerTime ? 'text-[#ef4444] drop-shadow-sm' : 'text-slate-500 dark:text-slate-400'
      }`}
    >
      {timeLeft}
    </motion.span>
  );
};

/**
 * Heads-Up Display bar showing round info, drawer status, word hint,
 * countdown timer, and navigation controls.
 *
 * Spans the full width above the Arena's three-column layout. On mobile,
 * an additional player-list toggle button is shown in the left column.
 *
 * @param props - {@link ArenaHUDProps}
 * @param props.onRequestLeave - Opens the leave-confirmation modal.
 * @param props.onToggleMobilePlayers - Toggles the mobile player list popup.
 * @param props.userId - The current user's ID, used to determine if they are the drawer.
 * @returns The HUD bar element.
 */
export const ArenaHUD = ({ onRequestLeave, onToggleMobilePlayers, userId }: ArenaHUDProps) => {
  const {
    gameState,
    currentRound,
    totalRounds,
    currentHint,
    config,
    currentDrawerId,
    players,
    roundId,
    wordLength,
    correctWord,
  } = useGameStore();

  // We default the timer to whatever the room config is set to
  const startingTime = config?.drawTimeSeconds || GAME_CONSTANTS.DEFAULT_DRAW_TIME_SECONDS;
  // Find the username of the person currently drawing
  const drawer = players.find((p) => p.id === currentDrawerId);

  // DYNAMIC FONT SCALING LOGIC
  const isDrawer = userId === currentDrawerId;
  const hintText = isDrawer && correctWord ? correctWord : currentHint || '? ? ?';
  const charCount = hintText.length;

  // Scale down the font size and the letter-spacing (tracking) as the word gets longer
  let hintSizingClass = 'text-2xl md:text-3xl lg:text-4xl tracking-[0.2em]'; // Default: Short words (1-10 chars)

  if (charCount > 15) {
    // Very long words/phrases (16-20 chars)
    hintSizingClass = 'text-sm md:text-xl lg:text-3xl tracking-wider';
  } else if (charCount > 10) {
    hintSizingClass = 'text-lg md:text-2xl lg:text-4xl tracking-widest';
  }

  return (
    <div className="w-full bg-white dark:bg-discord-card border-4 border-gray-200 dark:border-discord-main rounded-2xl md:rounded-3xl shadow-sm p-3 md:p-4 flex justify-between items-center shrink-0 transition-colors">
      {/* LEFT: Round Info & Mobile Players Toggle */}
      <div className="flex items-center gap-2 md:gap-4 min-w-16 md:min-w-30 shrink-0">
        {/* Mobile-only toggle button */}
        <button
          onClick={onToggleMobilePlayers}
          className="lg:hidden p-2 bg-gray-100 dark:bg-discord-main rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 active:scale-95 transition-transform"
        >
          <Users size={20} />
        </button>

        <div className="flex flex-col text-center">
          <span className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest">
            Round
          </span>
          <span className="text-xl md:text-2xl font-black text-green-500 dark:text-neon-blue">
            {currentRound}{' '}
            <span className="text-sm md:text-lg text-gray-300 dark:text-gray-600">
              / {totalRounds}
            </span>
          </span>
        </div>
      </div>

      {/* CENTER: Drawer Status & Animated Hint */}
      <div className="flex flex-col text-center flex-1 px-1 md:px-2 border-x-2 border-gray-100 dark:border-gray-800 mx-1 md:mx-4 min-w-0">
        <span className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest flex items-center justify-center gap-1">
          {drawer ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center justify-center gap-1 w-full min-w-0"
            >
              <Edit2 size={12} className="text-red-500 dark:text-neon-pink shrink-0" />

              <span className="truncate max-w-20 md:max-w-none">{drawer.username}</span>

              <span className="shrink-0">is drawing</span>
            </motion.div>
          ) : (
            'Waiting...'
          )}
        </span>

        <AnimatePresence mode="popLayout">
          <motion.div
            key={currentHint}
            initial={{ y: -5, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="mt-0.5 w-full wrap-break-word leading-tight"
          >
            <span
              className={`font-mono font-black text-gray-900 dark:text-gray-100 transition-all ${hintSizingClass}`}
            >
              {hintText}
            </span>
            {/* Super script of word length if available */}
            {wordLength ? (
              <sup className="text-[10px] md:text-xs font-sans font-black text-gray-400 dark:text-gray-500 tracking-normal ml-1 relative -top-1.5 md:-top-3 shrink-0">
                {wordLength}
              </sup>
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* RIGHT: Timer & Quit Button */}
      <div className="flex items-center gap-3 md:gap-5 min-w-16 md:min-w-30 justify-end shrink-0">
        <div className="flex flex-col items-center text-center">
          <span className="text-[10px] md:text-xs text-gray-400 dark:text-gray-500 font-black uppercase tracking-widest flex items-center gap-1">
            <Clock size={12} /> Time
          </span>

          {gameState === GameState.DRAWING ? (
            <HUDTimer key={`timer-round-${roundId}`} duration={startingTime} />
          ) : (
            <span className="text-xl md:text-2xl font-black tabular-nums text-slate-500 dark:text-slate-400">
              {startingTime}
            </span>
          )}
        </div>

        {/* Integrated Quit button directly into the HUD */}
        <button
          onClick={onRequestLeave}
          className="p-2 md:px-4 md:py-2.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-500 border-2 border-red-200 dark:border-red-900/50 rounded-xl hover:bg-red-100 dark:hover:bg-red-900/40 active:scale-95 transition-all flex items-center gap-2 font-bold text-sm shrink-0"
          title="Quit Game"
        >
          <LogOut size={18} strokeWidth={2.5} />
          <span className="hidden md:inline">Quit</span>
        </button>
      </div>
    </div>
  );
};
