'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown } from 'lucide-react';

export interface PlayerStanding {
  id: string;
  username: string;
  score: number;
  rank: number;
  avatarSeed?: string;
}

interface GameOverModalProps {
  isOpen: boolean;
  standings: PlayerStanding[];
  isHost: boolean;
  onPlayAgain: () => void;
}

export const GameOverModal = ({ isOpen, standings, isHost, onPlayAgain }: GameOverModalProps) => {
  const firstPlace = standings?.find((p) => p.rank === 1);
  const secondPlace = standings?.find((p) => p.rank === 2);
  const thirdPlace = standings?.find((p) => p.rank === 3);
  const runnerUps = standings?.filter((p) => p.rank > 3) || [];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="w-full max-w-2xl bg-white dark:bg-discord-card rounded-[2.5rem] border-4 border-gray-200 dark:border-discord-main p-6 lg:p-10 shadow-2xl flex flex-col items-center gap-8"
          >
            <div className="flex flex-col items-center gap-2">
              <Trophy size={48} className="text-yellow-400 drop-shadow-md" strokeWidth={2} />
              <h2 className="text-4xl lg:text-5xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                Game Over!
              </h2>
            </div>

            <div className="flex items-end justify-center gap-2 lg:gap-4 h-48 mt-4">
              {/* SILVER PODIUM */}
              {secondPlace && (
                <div className="flex flex-col items-center gap-2">
                  <span className="font-bold text-gray-400 text-sm">{secondPlace.username}</span>
                  <span className="font-black text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-discord-main px-3 py-1 rounded-full text-xs">
                    {secondPlace.score} pts
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '96px' }}
                    transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                    className="w-20 lg:w-24 bg-gray-300 dark:bg-discord-main rounded-t-2xl border-x-4 border-t-4 border-gray-400 dark:border-gray-500 flex justify-center pt-2 shadow-inner"
                  >
                    <span className="text-2xl font-black text-gray-500 dark:text-gray-400">2</span>
                  </motion.div>
                </div>
              )}

              {/* GOLD PODIUM */}
              {firstPlace && (
                <div className="flex flex-col items-center gap-2 z-10">
                  <Crown
                    size={24}
                    className="text-yellow-500 -mb-2 animate-bounce"
                    strokeWidth={3}
                  />
                  <span className="font-black text-yellow-600 dark:text-yellow-400 text-lg">
                    {firstPlace.username}
                  </span>
                  <span className="font-black text-gray-900 dark:text-gray-100 bg-yellow-100 dark:bg-discord-main border-2 border-yellow-200 dark:border-yellow-900/30 px-3 py-1 rounded-full text-xs">
                    {firstPlace.score} pts
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '144px' }}
                    transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
                    className="w-24 lg:w-32 bg-yellow-400 dark:bg-yellow-500 rounded-t-2xl border-x-4 border-t-4 border-yellow-500 dark:border-yellow-600 flex justify-center pt-2 shadow-[0_-10px_20px_rgba(234,179,8,0.2)]"
                  >
                    <span className="text-4xl font-black text-yellow-700 dark:text-yellow-800">
                      1
                    </span>
                  </motion.div>
                </div>
              )}

              {/* BRONZE PODIUM */}
              {thirdPlace && (
                <div className="flex flex-col items-center gap-2">
                  <span className="font-bold text-orange-400 text-sm">{thirdPlace.username}</span>
                  <span className="font-black text-gray-900 dark:text-gray-100 bg-orange-50 dark:bg-discord-main px-3 py-1 rounded-full text-xs">
                    {thirdPlace.score} pts
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '72px' }}
                    transition={{ duration: 0.6, delay: 0, ease: 'easeOut' }}
                    className="w-20 lg:w-24 bg-orange-300 dark:bg-orange-900/40 rounded-t-2xl border-x-4 border-t-4 border-orange-400 dark:border-orange-800/80 flex justify-center pt-2 shadow-inner"
                  >
                    <span className="text-xl font-black text-orange-600 dark:text-orange-500">
                      3
                    </span>
                  </motion.div>
                </div>
              )}
            </div>

            {/* RUNNER UPS */}
            {runnerUps.length > 0 && (
              <div className="w-full max-w-md bg-gray-50 dark:bg-discord-main rounded-2xl p-4 border-2 border-gray-100 dark:border-discord-main mt-4 flex flex-col gap-2 max-h-40 overflow-y-auto custom-scrollbar">
                {runnerUps.map((player) => (
                  <div
                    key={player.id}
                    className="flex justify-between items-center px-4 py-2 bg-white dark:bg-discord-card rounded-xl font-bold border-2 border-transparent shadow-sm"
                  >
                    <span className="text-gray-500 dark:text-gray-400 w-8">#{player.rank}</span>
                    <span className="flex-1 text-left dark:text-gray-200">{player.username}</span>
                    {/* DYNAMIC TEXT: Green for Light, Neon Blue for Dark */}
                    <span className="text-green-500 dark:text-neon-blue">{player.score} pts</span>
                  </div>
                ))}
              </div>
            )}

            {/* CONTROLS */}
            <div className="w-full mt-4">
              {isHost ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onPlayAgain}
                  // DYNAMIC BUTTON: Green for Light, Neon Blue for Dark
                  className="w-full flex items-center justify-center gap-2 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white py-4 rounded-2xl font-black text-xl border-b-4 border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 transition-all"
                >
                  Return to Lobby & Play Again
                </motion.button>
              ) : (
                <div className="w-full bg-gray-100 dark:bg-discord-main py-4 rounded-2xl text-center font-bold text-gray-500 animate-pulse border-2 border-gray-200 dark:border-discord-main">
                  Waiting for Host to restart...
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
