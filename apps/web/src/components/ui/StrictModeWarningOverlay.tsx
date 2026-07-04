'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Plus, Play, Shuffle } from 'lucide-react';

interface StrictModeWarningOverlayProps {
  isOpen: boolean;
  customWordCount: number;
  minRequired: number;
  onAddMoreWords: () => void;
  onTurnOffStrictModeAndStart: () => void;
  onStartAnyway: () => void;
}

export const StrictModeWarningOverlay = ({
  isOpen,
  customWordCount,
  minRequired,
  onAddMoreWords,
  onTurnOffStrictModeAndStart,
  onStartAnyway,
}: StrictModeWarningOverlayProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-md bg-white dark:bg-discord-card rounded-[2rem] border-4 border-amber-400 dark:border-amber-500 p-6 shadow-2xl flex flex-col items-center gap-5 text-center"
          >
            <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 text-amber-500 dark:text-amber-400 rounded-full flex items-center justify-center mb-1 shrink-0">
              <AlertTriangle size={32} strokeWidth={2.5} />
            </div>

            <div>
              <h3 className="text-2xl font-black text-gray-900 dark:text-white mb-2">
                Not Enough Words!
              </h3>
              <p className="text-sm font-bold text-gray-500 dark:text-gray-400 leading-relaxed">
                Strict Mode requires at least{' '}
                <strong className="text-amber-500 dark:text-amber-400">{minRequired}</strong> words
                (with current config) to ensure no repeats during the game. You only have{' '}
                <strong className="text-amber-500 dark:text-amber-400">{customWordCount}</strong>.
                How would you like to proceed?
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full mt-2 text-left">
              {/* Option 1: Back to Editor */}
              <button
                onClick={onAddMoreWords}
                className="w-full p-4 rounded-xl bg-amber-50 dark:bg-amber-900/10 border-2 border-amber-300 dark:border-amber-700/50 hover:bg-amber-100 dark:hover:bg-amber-900/30 active:scale-[0.98] transition-all group flex items-start gap-4"
              >
                <div className="bg-amber-200 dark:bg-amber-600/30 p-2 rounded-lg text-amber-700 dark:text-amber-400 shrink-0">
                  <Plus size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="font-black text-amber-900 dark:text-amber-400 block mb-0.5">
                    Add More Words
                  </span>
                  <span className="text-[11px] font-bold text-amber-700/70 dark:text-amber-500/70 leading-tight block">
                    Open the editor to add more words. Recommended for the best experience.
                  </span>
                </div>
              </button>

              {/* Option 2: Disable Strict Mode & Start instantly */}
              <button
                onClick={onTurnOffStrictModeAndStart}
                className="w-full p-4 rounded-xl bg-gray-50 dark:bg-discord-main border-2 border-gray-200 dark:border-gray-800 hover:border-green-400 dark:hover:border-neon-blue active:scale-[0.98] transition-all group flex items-start gap-4"
              >
                <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded-lg text-gray-600 dark:text-gray-300 group-hover:bg-green-100 group-hover:text-green-600 dark:group-hover:bg-neon-blue/20 dark:group-hover:text-neon-blue shrink-0 transition-colors">
                  <Shuffle size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="font-black text-gray-800 dark:text-gray-200 block mb-0.5">
                    Turn Off & Start Immediately
                  </span>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-tight block">
                    Use your words first, then seamlessly mix in default game words when you run
                    out.
                  </span>
                </div>
              </button>

              {/* Option 3: Ignore & Start instantly */}
              <button
                onClick={onStartAnyway}
                className="w-full p-4 rounded-xl bg-gray-50 dark:bg-discord-main border-2 border-gray-200 dark:border-gray-800 hover:border-red-400 dark:hover:border-neon-pink active:scale-[0.98] transition-all group flex items-start gap-4"
              >
                <div className="bg-gray-200 dark:bg-gray-800 p-2 rounded-lg text-gray-600 dark:text-gray-300 group-hover:bg-red-100 group-hover:text-red-600 dark:group-hover:bg-neon-pink/20 dark:group-hover:text-neon-pink shrink-0 transition-colors">
                  <Play size={20} strokeWidth={3} />
                </div>
                <div>
                  <span className="font-black text-gray-800 dark:text-gray-200 block mb-0.5">
                    Start Anyway (Allow Repeats)
                  </span>
                  <span className="text-[11px] font-bold text-gray-500 dark:text-gray-400 leading-tight block">
                    Keep Strict Mode ON. The game will randomly repeat your custom words.
                  </span>
                </div>
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
