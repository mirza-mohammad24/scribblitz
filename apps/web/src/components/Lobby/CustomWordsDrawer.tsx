'use client';

/**
 * @module CustomWordsDrawer
 * @description A slide-up drawer modal that allows the host to input custom words
 * for the game. Words can be separated by commas or new lines. Validates word
 * count limits, individual word length, and words-per-phrase constraints before
 * saving. Matches Zod schema constraints to prevent server-side rejection.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X } from 'lucide-react';
import { GAME_CONSTANTS } from '@scribblitz/shared';

interface CustomWordsDrawerProps {
  isOpen: boolean;
  initialWords: string[];
  onClose: () => void;
  onSave: (words: string[]) => void;
}

/**
 * CustomWordsDrawer component for allowing the host to input custom words for the game.
 * @param param0 the component props including `isOpen`, `initialWords`, `onClose`, and `onSave`.
 * @returns
 */
export const CustomWordsDrawer = ({
  isOpen,
  initialWords,
  onClose,
  onSave,
}: CustomWordsDrawerProps) => {
  const [input, setInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);

  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setInput(initialWords.join('\n')); // Hydrate when it opens
      setError(null);
    }
  }

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 400);
  };

  /**
   * Parses the textarea input by splitting on commas and newlines, trims
   * whitespace, and validates against maximum word count, maximum word length,
   * and maximum words-per-phrase limits. Triggers a shake animation on
   * validation failure. On success, invokes {@link CustomWordsDrawerProps.onSave}
   * with the cleaned word list.
   * @returns {void}
   */
  const handleSave = () => {
    // Split by commas or new lines, trim whitespace, and remove empty entries
    const words = input
      .split(/[\n,]+/)
      .map((w) => w.trim())
      .filter((w) => w.length > 0);

    // Strict Validation (Matches our Zod Schema to prevent server rejection)
    if (words.length > GAME_CONSTANTS.MAX_CUSTOM_WORDS) {
      setError(`You cannot exceed ${GAME_CONSTANTS.MAX_CUSTOM_WORDS} custom words.`);
      triggerShake();
      return;
    }

    const overLengthWord = words.find((w) => w.length > GAME_CONSTANTS.MAX_WORD_LENGTH);
    if (overLengthWord) {
      setError(
        `Words cannot exceed ${GAME_CONSTANTS.MAX_WORD_LENGTH} characters ("${overLengthWord.substring(0, 10)}...").`,
      );
      triggerShake();
      return;
    }

    const tooManyWordsPhrase = words.find(
      (w) => w.split(/\s+/).filter(Boolean).length > GAME_CONSTANTS.MAX_WORDS_PER_PHRASE,
    );
    if (tooManyWordsPhrase) {
      setError(
        `Phrases can have at most ${GAME_CONSTANTS.MAX_WORDS_PER_PHRASE} words ("${tooManyWordsPhrase.substring(0, 15)}...").`,
      );
      triggerShake();
      return;
    }

    setError(null);
    onSave(words);
  };

  /**
   * Updates the textarea input state and clears any existing validation error.
   * @param {string} val - The new textarea content.
   * @returns {void}
   */
  const handleInputChange = (val: string) => {
    setInput(val);
    if (error) setError(null);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-100 flex md:items-center justify-center bg-black/60 backdrop-blur-sm p-0 md:p-4"
        >
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="w-full md:max-w-2xl h-[85vh] md:h-auto md:max-h-[85vh] bg-white dark:bg-discord-card rounded-t-3xl md:rounded-4xl border-t-4 md:border-4 border-gray-200 dark:border-discord-main shadow-2xl flex flex-col absolute bottom-0 md:relative overflow-hidden"
          >
            {/* Drawer Header */}
            <div className="flex justify-between items-center p-5 md:p-6 border-b-2 border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-neon-blue/20 rounded-xl text-green-600 dark:text-neon-blue">
                  <BookOpen size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white">
                    Custom Words
                  </h2>
                  <p className="text-[10px] md:text-xs text-gray-500 font-bold">
                    Separate by{' '}
                    <strong className="text-green-500 dark:text-neon-blue">commas (,)</strong> or
                    new lines.
                    <br className="md:hidden" /> Max {GAME_CONSTANTS.MAX_WORDS_PER_PHRASE} words per
                    phrase ({GAME_CONSTANTS.MAX_WORD_LENGTH} character limit total).
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-800 rounded-full"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            {/* Drawer Body with Shake Animation */}
            <div className="flex-1 p-5 md:p-6 overflow-hidden flex flex-col gap-3">
              <motion.div
                className="flex-1 flex flex-col min-h-0"
                animate={{ x: shake ? [-10, 10, -10, 10, 0] : 0 }}
                transition={{ duration: 0.4 }}
              >
                <textarea
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="apple, banana, rocket ship, pizza..."
                  className={`flex-1 w-full p-4 border-4 rounded-2xl font-mono text-sm resize-none focus:outline-none transition-colors custom-scrollbar ${
                    error
                      ? 'border-red-500 focus:border-red-600 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                      : 'bg-gray-50 dark:bg-[#111214] border-gray-200 dark:border-gray-700 focus:border-green-500 dark:focus:border-neon-blue text-gray-900 dark:text-gray-100'
                  }`}
                />
              </motion.div>
              {error && (
                <span className="text-red-500 font-bold text-sm text-center animate-in fade-in slide-in-from-top-1">
                  {error}
                </span>
              )}
            </div>

            {/* Drawer Footer */}
            <div className="p-5 md:p-6 border-t-2 border-gray-100 dark:border-gray-800 shrink-0 flex gap-3">
              <button
                onClick={onClose}
                className="flex-1 py-3 rounded-xl font-black text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-[0.98]"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="flex-2 py-3 rounded-xl font-black text-white bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover border-b-4 border-green-700 dark:border-green-900 active:border-b-0 active:translate-y-1 transition-all"
              >
                Save List
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
