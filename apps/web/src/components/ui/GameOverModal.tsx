'use client';

/**
 * @module GameOverModal
 * @description An animated end-of-game results screen displaying a podium with
 * gold, silver, and bronze standings, player avatars and scores, and action
 * buttons. The host sees a "Return to Lobby & Play Again" button while non-hosts
 * see a "Waiting for Host to restart..." indicator.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, LogOut, Loader2 } from 'lucide-react';
import Image from 'next/image';

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
  onLeaveRoom: () => void;
}

/**
 * Renders the game-over results modal with an animated podium showing the top 3
 * players, their DiceBear avatars, and point totals. Provides a "Return to Lobby
 * & Play Again" button for the host and a waiting state for non-hosts. All
 * players have access to a "Leave Room" escape hatch.
 * @param {GameOverModalProps} props - The component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {PlayerStanding[]} props.standings - Array of player standings with rank, score, and avatar data.
 * @param {boolean} props.isHost - Whether the current user is the room host.
 * @param {() => void} props.onPlayAgain - Callback for the host to return to the lobby.
 * @param {() => void} props.onLeaveRoom - Callback to leave the room entirely.
 * @returns {React.JSX.Element} The animated game-over modal JSX, or nothing when closed.
 */
export const GameOverModal = ({
  isOpen,
  standings,
  isHost,
  onPlayAgain,
  onLeaveRoom,
}: GameOverModalProps) => {
  const firstPlace = standings?.find((p) => p.rank === 1);
  const secondPlace = standings?.find((p) => p.rank === 2);
  const thirdPlace = standings?.find((p) => p.rank === 3);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="w-full max-w-2xl bg-white dark:bg-discord-card rounded-4xl md:rounded-[2.5rem] border-4 border-gray-200 dark:border-discord-main p-5 md:p-8 shadow-2xl flex flex-col items-center gap-4 md:gap-6 max-h-[95vh] overflow-y-auto hide-scrollbar"
          >
            {/* HEADER */}
            <div className="flex flex-col items-center gap-1 md:gap-2 shrink-0 mt-2">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: 'spring', bounce: 0.5, duration: 0.8 }}
              >
                <Trophy
                  size={42}
                  className="text-yellow-400 drop-shadow-md md:w-14 md:h-14"
                  strokeWidth={2}
                />
              </motion.div>
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                Game Over!
              </h2>
            </div>

            {/* PODIUM */}
            <div className="flex items-end justify-center gap-2 lg:gap-4 h-62.5 md:h-70 shrink-0">
              {/* SILVER PODIUM (2nd) */}
              {secondPlace && (
                <div className="flex flex-col items-center gap-1.5">
                  <Image
                    src={`https://api.dicebear.com/10.x/micah/svg?seed=${secondPlace.avatarSeed || secondPlace.username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f2c2e0,b4e2b9,ffeab6&radius=50&glassesProbability=30&facialHairProbability=20&earringsProbability=30`}
                    alt={secondPlace.username}
                    width={40}
                    height={40}
                    unoptimized
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-gray-300 dark:border-gray-500 bg-gray-50 dark:bg-discord-main shadow-sm"
                  />
                  <span className="font-bold text-gray-500 dark:text-gray-400 text-xs md:text-sm truncate max-w-17.5 md:max-w-20 text-center">
                    {secondPlace.username}
                  </span>
                  <span className="font-black text-gray-900 dark:text-gray-100 bg-gray-100 dark:bg-discord-main px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs border border-gray-200 dark:border-gray-700">
                    {secondPlace.score} pts
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '80px' }}
                    transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
                    className="w-16 md:w-20 lg:w-24 bg-linear-to-t from-gray-300 to-gray-100 dark:from-gray-700 dark:to-gray-500 rounded-t-2xl border-x-4 border-t-4 border-gray-400 dark:border-gray-400 flex justify-center pt-2 shadow-inner relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 dark:bg-white/5" />
                    <span className="text-2xl md:text-3xl font-black text-gray-500 dark:text-gray-300 drop-shadow-sm z-10">
                      2
                    </span>
                  </motion.div>
                </div>
              )}

              {/* GOLD PODIUM (1st) */}
              {firstPlace && (
                <div className="flex flex-col items-center gap-1.5 z-10">
                  <Crown
                    size={24}
                    className="text-yellow-500 -mb-2 md:-mb-3 animate-bounce drop-shadow-md md:w-7 md:h-7"
                    strokeWidth={3}
                  />
                  <Image
                    src={`https://api.dicebear.com/10.x/micah/svg?seed=${firstPlace.avatarSeed || firstPlace.username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f2c2e0,b4e2b9,ffeab6&radius=50&glassesProbability=30&facialHairProbability=20&earringsProbability=30`}
                    alt={firstPlace.username}
                    width={48}
                    height={48}
                    unoptimized
                    className="w-11 h-11 md:w-12 md:h-12 rounded-full border-2 border-yellow-400 dark:border-yellow-500 bg-yellow-50 dark:bg-discord-main shadow-md"
                  />
                  <span className="font-black text-yellow-600 dark:text-yellow-400 text-sm md:text-lg truncate max-w-21.25 md:max-w-25 text-center">
                    {firstPlace.username}
                  </span>
                  <span className="font-black text-gray-900 dark:text-gray-100 bg-yellow-100 dark:bg-discord-main border-2 border-yellow-200 dark:border-yellow-900/30 px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs shadow-sm">
                    {firstPlace.score} pts
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '120px' }}
                    transition={{ duration: 0.6, delay: 0.4, ease: 'easeOut' }}
                    className="w-20 md:w-24 lg:w-32 bg-linear-to-t from-yellow-500 to-yellow-300 dark:from-yellow-700 dark:to-yellow-500 rounded-t-2xl border-x-4 border-t-4 border-yellow-400 dark:border-yellow-500 flex justify-center pt-1 md:pt-2 shadow-[0_-10px_20px_rgba(234,179,8,0.25)] relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 dark:bg-white/10" />
                    <span className="text-4xl md:text-5xl font-black text-yellow-700 dark:text-yellow-300 drop-shadow-sm z-10">
                      1
                    </span>
                  </motion.div>
                </div>
              )}

              {/* BRONZE PODIUM (3rd) */}
              {thirdPlace && (
                <div className="flex flex-col items-center gap-1.5">
                  <Image
                    src={`https://api.dicebear.com/10.x/micah/svg?seed=${thirdPlace.avatarSeed || thirdPlace.username}&backgroundColor=b6e3f4,c0aede,d1d4f9,ffd5dc,ffdfbf,f2c2e0,b4e2b9,ffeab6&radius=50&glassesProbability=30&facialHairProbability=20&earringsProbability=30`}
                    alt={thirdPlace.username}
                    width={40}
                    height={40}
                    unoptimized
                    className="w-9 h-9 md:w-10 md:h-10 rounded-full border-2 border-orange-400 dark:border-orange-600 bg-orange-50 dark:bg-discord-main shadow-sm"
                  />
                  <span className="font-bold text-orange-500 dark:text-orange-500 text-xs md:text-sm truncate max-w-17.5 md:max-w-20 text-center">
                    {thirdPlace.username}
                  </span>
                  <span className="font-black text-gray-900 dark:text-gray-100 bg-orange-50 dark:bg-discord-main px-2 md:px-3 py-0.5 md:py-1 rounded-full text-[10px] md:text-xs border border-orange-200 dark:border-orange-900/30">
                    {thirdPlace.score} pts
                  </span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: '60px' }}
                    transition={{ duration: 0.6, delay: 0, ease: 'easeOut' }}
                    className="w-16 md:w-20 lg:w-24 bg-linear-to-t from-orange-400 to-orange-200 dark:from-orange-800 dark:to-orange-600 rounded-t-2xl border-x-4 border-t-4 border-orange-500 dark:border-orange-700 flex justify-center pt-2 shadow-inner relative overflow-hidden"
                  >
                    <div className="absolute inset-0 bg-white/20 dark:bg-white/5" />
                    <span className="text-xl md:text-2xl font-black text-orange-700 dark:text-orange-400 drop-shadow-sm z-10">
                      3
                    </span>
                  </motion.div>
                </div>
              )}
            </div>

            {/* CONTROLS */}
            <div className="w-full flex flex-col gap-2 md:gap-3 shrink-0">
              {isHost ? (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onPlayAgain}
                  className="w-full flex items-center justify-center gap-2 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white py-3 md:py-4 rounded-xl md:rounded-2xl font-black text-lg md:text-xl border-b-4 border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 transition-all shadow-lg"
                >
                  Return to Lobby & Play Again
                </motion.button>
              ) : (
                <div className="w-full bg-gray-50 dark:bg-discord-main py-3 md:py-4 rounded-xl md:rounded-2xl flex justify-center items-center gap-3 font-bold text-gray-500 dark:text-gray-400 border-2 border-gray-200 dark:border-gray-800 shadow-inner text-sm md:text-base">
                  <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={20} />
                  Waiting for Host to restart...
                </div>
              )}

              {/* LEAVE ROOM ESCAPE HATCH */}
              <button
                onClick={onLeaveRoom}
                className="w-full py-2.5 md:py-3 rounded-xl font-bold text-red-500 dark:text-neon-pink hover:bg-red-50 dark:hover:bg-red-900/20 active:scale-95 transition-all flex justify-center items-center gap-2 text-sm md:text-base"
              >
                <LogOut size={18} /> Leave Room
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
