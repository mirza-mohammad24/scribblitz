'use client';

/**
 * @module GameAbortModal
 * @description An inescapable modal shown when a match is cancelled because
 * the player count has fallen below the minimum required to continue.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { UserX } from 'lucide-react';

interface GameAbortedModalProps {
  isOpen: boolean;
  onGoHome: () => void;
}

/**
 * Renders a blocking abort state that informs the user the game was cancelled
 * and provides a single action to return home.
 * @param {GameAbortedModalProps} props - The component props.
 * @param {boolean} props.isOpen - Whether the modal is visible.
 * @param {() => void} props.onGoHome - Callback fired when the user returns home.
 * @returns {React.JSX.Element} The abort modal JSX.
 */
export const GameAbortedModal = ({ isOpen, onGoHome }: GameAbortedModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-200 flex items-center justify-center p-4 bg-black/80 backdrop-blur-lg"
          // There is no backdrop here. This modal is INESCAPABLE
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', duration: 0.5, bounce: 0.3 }}
            className="w-full max-w-md bg-white dark:bg-discord-card rounded-4xl border-4 border-red-500 dark:border-neon-pink p-8 shadow-2xl flex flex-col items-center gap-6"
          >
            <div className="bg-red-100 dark:bg-neon-pink/20 p-4 rounded-full">
              <UserX size={48} className="text-red-500 dark:text-neon-pink" />
            </div>

            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-100 text-center">
              Not Enough Players!
            </h2>
            <p className="text-gray-500 dark:text-gray-400 font-bold text-center">
              The game has been cancelled because there aren&apos;t enough players to continue.
            </p>

            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={onGoHome}
              className="w-full py-4 rounded-2xl font-black text-xl text-white bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover border-b-4 border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 transition-all shadow-lg"
            >
              Return to Home
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
