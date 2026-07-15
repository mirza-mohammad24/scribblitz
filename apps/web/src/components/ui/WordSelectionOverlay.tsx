'use client';

/**
 * @module WordSelectionOverlay
 * @description An animated overlay that prompts the drawer to choose a word
 * while giving other players a waiting state and synced timer feedback.
 */
import { useGameStore } from '@/store/gameStore';
import { useSyncedTimer } from '@/hooks/useSyncedTimer';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { motion, Variants } from 'framer-motion';
import { Timer, Pencil, Eye } from 'lucide-react';

interface WordSelectionOverlayProps {
  isDrawer: boolean;
  wordChoices: string[];
  onSelect: (word: string) => void;
}

// Framer Motion Variants for bouncy pop-in effects
const containerVariants: Variants = {
  hidden: { opacity: 0, scale: 0.8, y: 30 },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 300,
      damping: 25,
      when: 'beforeChildren',
      staggerChildren: 0.1,
    },
  },
  exit: { opacity: 0, scale: 0.9, y: 20, transition: { duration: 0.2 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15, scale: 0.9 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
};

/**
 * Renders the word selection overlay for either the active drawer or the
 * waiting audience, including animated word choices and a synced countdown.
 * @param {WordSelectionOverlayProps} props - The component props.
 * @param {boolean} props.isDrawer - Whether the current user is drawing.
 * @param {string[]} props.wordChoices - The candidate words to display.
 * @param {(word: string) => void} props.onSelect - Callback fired when a word is chosen.
 * @returns {React.JSX.Element} The animated word selection overlay JSX.
 */
export const WordSelectionOverlay = ({
  isDrawer,
  wordChoices,
  onSelect,
}: WordSelectionOverlayProps) => {
  const { localPhaseEndTime } = useGameStore();
  // Calculate progress against the absolute server start time
  const { progress } = useSyncedTimer(
    localPhaseEndTime,
    GAME_CONSTANTS.WORD_SELECTION_TIMEOUT_SECONDS,
  );

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-md bg-white dark:bg-discord-card rounded-4xl md:rounded-[2.5rem] border-4 border-yellow-400 dark:border-yellow-500 p-6 md:p-8 shadow-2xl flex flex-col gap-5 relative overflow-hidden"
        style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
      >
        {/* Dynamic Header based on Role */}
        <div className="text-center flex flex-col items-center gap-1 relative z-10">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.1 }}
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-discord-main px-4 py-1.5 rounded-full border-2 border-gray-200 dark:border-gray-800 shadow-sm mb-2"
          >
            {isDrawer ? (
              <>
                <Pencil size={16} className="text-yellow-500 dark:text-yellow-400" />
                <span className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Your Turn to Draw!
                </span>
              </>
            ) : (
              <>
                <Eye size={16} className="text-blue-500 dark:text-blue-400" />
                <span className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
                  Get Ready to Guess
                </span>
              </>
            )}
          </motion.div>

          {isDrawer ? (
            <h2 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-gray-200">
              Pick a Word
            </h2>
          ) : (
            <h2 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-gray-200 mt-2 mb-4">
              Waiting for Drawer...
            </h2>
          )}
        </div>

        {/* The Body */}
        <div className="flex flex-col gap-3 relative z-10 w-full mb-2">
          {isDrawer &&
            wordChoices?.map((word) => {
              //DYNAMIC FONT SIZING PER BUTTON
              const isVeryLong = word.length > 15;
              const isMedium = word.length > 10;
              const textSizeClass = isVeryLong
                ? 'text-sm md:text-base'
                : isMedium
                  ? 'text-base md:text-lg'
                  : 'text-lg md:text-xl';

              return (
                <motion.button
                  key={word}
                  variants={itemVariants}
                  onClick={() => onSelect(word)}
                  className={`w-full bg-green-500 dark:bg-neon-blue text-white px-4 py-3.5 md:py-4 rounded-2xl font-black border-b-[5px] border-green-700 dark:border-blue-900 hover:bg-green-600 dark:hover:bg-blue-600 hover:-translate-y-1 hover:border-b-[6px] active:border-b-0 active:translate-y-1 transition-all shadow-sm whitespace-normal wrap-break-word leading-tight ${textSizeClass}`}
                >
                  {word}
                </motion.button>
              );
            })}
        </div>

        {/* Playful Cartoonish Progress Bar */}
        <div className="flex flex-col gap-2 relative z-10 w-full">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] md:text-xs font-black text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1">
              <Timer size={14} /> Time Remaining
            </span>
            {/*comment out the time display */}
            {/*<span className="text-xs font-black text-red-500 dark:text-neon-pink">{timeLeft}s</span>*/}
          </div>

          <div className="w-full h-6 bg-gray-100 dark:bg-discord-main rounded-full border-4 border-gray-200 dark:border-gray-800 relative shadow-inner p-0.5 flex items-center">
            <div
              className="h-full bg-red-500 dark:bg-neon-pink rounded-full shadow-[inset_0_-4px_rgba(0,0,0,0.2)] relative overflow-hidden"
              style={{ width: `${progress}%`, minWidth: '5%' }}
            >
              <div className="absolute top-0 left-0 right-0 h-2 bg-white/20 rounded-t-full" />
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
