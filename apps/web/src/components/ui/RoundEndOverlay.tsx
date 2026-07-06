'use client';

import { motion, AnimatePresence, Variants } from 'framer-motion';
import { useGameStore } from '@/store/gameStore';
import { useSyncedTimer } from '@/hooks/useSyncedTimer';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { Sparkles, Trophy, Timer } from 'lucide-react';

// Framer Motion Variants for staggered pop-in effects
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
  hidden: { opacity: 0, x: -20, scale: 0.8 },
  visible: {
    opacity: 1,
    x: 0,
    scale: 1,
    transition: { type: 'spring', stiffness: 300, damping: 20 },
  },
};

export const RoundEndOverlay = () => {
  const { correctWord, roundEndReason, players, previousScores, isFinalRound } = useGameStore();

  //Call the hook with current duration
  const { progress } = useSyncedTimer(GAME_CONSTANTS.ROUND_END_DISPLAY_SECONDS);

  // Sort players by who gained the most points this round
  const sortedPlayers = [...players]
    .filter((p) => p.isConnected)
    .sort((a, b) => {
      const deltaA = a.score - (previousScores[a.id] || 0);
      const deltaB = b.score - (previousScores[b.id] || 0);
      return deltaB - deltaA;
    });

  return (
    <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md">
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="w-full max-w-md bg-white dark:bg-discord-card rounded-4xl md:rounded-[2.5rem] border-4 border-green-500 dark:border-neon-blue p-5 md:p-8 shadow-2xl flex flex-col gap-6 relative overflow-hidden"
        style={{ WebkitMaskImage: '-webkit-radial-gradient(white, black)' }}
      >
        {/* Header Section */}
        <div className="text-center flex flex-col items-center gap-1 relative z-10">
          <motion.div
            initial={{ scale: 0, rotate: -15 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15, delay: 0.2 }}
            className="inline-flex items-center gap-2 bg-gray-100 dark:bg-discord-main px-4 py-1.5 rounded-full border-2 border-gray-200 dark:border-gray-800 shadow-sm"
          >
            <Sparkles size={16} className="text-yellow-500 dark:text-yellow-400" />
            <span className="text-xs font-black text-gray-500 dark:text-gray-400 uppercase tracking-widest">
              {roundEndReason === 'all_guessed' ? 'Everyone got it!' : 'Time is up!'}
            </span>
            <Sparkles size={16} className="text-yellow-500 dark:text-yellow-400" />
          </motion.div>

          <h2 className="text-2xl md:text-3xl font-black text-gray-800 dark:text-gray-200 mt-3">
            The word was
          </h2>

          <motion.span
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.3 }}
            className="text-4xl md:text-5xl font-black text-green-600 dark:text-neon-blue mt-1 drop-shadow-sm uppercase tracking-wide wrap-break-word"
          >
            {correctWord}
          </motion.span>
        </div>

        {/* Score Deltas List */}
        <div className="flex flex-col gap-2.5 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2 relative z-10">
          <AnimatePresence>
            {sortedPlayers.map((p, index) => {
              const previousScore = previousScores[p.id] || 0;
              const delta = p.score - previousScore;
              const isTopGuesser = delta > 0 && index === 0;

              return (
                <motion.div
                  key={p.id}
                  variants={itemVariants}
                  layout
                  className={`flex justify-between items-center p-3 md:p-4 rounded-2xl border-4 transition-colors ${
                    isTopGuesser
                      ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-300 dark:border-yellow-600/50 shadow-sm'
                      : 'bg-gray-50 dark:bg-discord-main border-gray-100 dark:border-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate pr-2">
                    {isTopGuesser && (
                      <Trophy size={18} className="text-yellow-500 shrink-0" strokeWidth={2.5} />
                    )}
                    <span
                      className={`font-black text-sm md:text-base truncate ${isTopGuesser ? 'text-yellow-700 dark:text-yellow-500' : 'text-gray-800 dark:text-gray-200'}`}
                    >
                      {p.username}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="flex items-center justify-center min-w-14 px-3 py-1.5 text-sm font-black text-gray-600 dark:text-gray-300 bg-gray-200/50 dark:bg-gray-800/80 rounded-xl border-2 border-gray-300 dark:border-gray-700 shadow-inner transition-colors">
                      {previousScore}
                    </span>
                    <motion.span
                      initial={delta > 0 ? { scale: 0 } : { opacity: 0 }}
                      animate={delta > 0 ? { scale: 1 } : { opacity: 1 }}
                      transition={{ type: 'spring', delay: index * 0.1 + 0.5 }}
                      className={`font-black text-sm px-3 py-1.5 rounded-xl border-b-[3px] active:border-b-0 active:translate-y-0.75 ${
                        delta > 0
                          ? 'bg-green-500 dark:bg-neon-blue text-white border-green-700 dark:border-blue-900 shadow-md'
                          : 'bg-gray-200 dark:bg-gray-700 text-gray-500 border-gray-300 dark:border-gray-800'
                      }`}
                    >
                      +{delta}
                    </motion.span>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Playful Cartoonish Progress Bar */}
        <div className="flex flex-col gap-2 mt-2 relative z-10">
          <div className="flex justify-between items-center px-1">
            <span className="text-[10px] md:text-xs font-black text-gray-400 dark:text-gray-500 uppercase flex items-center gap-1">
              {isFinalRound ? (
                <>🏆 Calculating Final Results...</>
              ) : (
                <>
                  <Timer size={14} /> Next Round In
                </>
              )}
            </span>
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
