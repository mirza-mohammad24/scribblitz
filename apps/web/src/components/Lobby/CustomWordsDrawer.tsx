'use client';

/**
 * @module CustomWordsDrawer
 * @description A slide-up drawer modal that allows the host to input custom words
 * for the game and AI-generated themes. Words can be separated by commas or new lines. Validates word
 * count limits, individual word length, and words-per-phrase constraints before
 * saving. Matches Zod schema constraints to prevent server-side rejection.
 */

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, X, Sparkles, Loader2, Edit3 } from 'lucide-react';
import { GAME_CONSTANTS } from '@scribblitz/shared';

interface CustomWordsDrawerProps {
  isOpen: boolean;
  initialWords: string[];
  isGenerating: boolean; // Indicates if the AI theme-based word generation is currently in progress
  onGenerateTheme: (theme: string) => void;
  onClose: () => void;
  onSave: (words: string[]) => void;
}

/**
 * CustomWordsDrawer component for allowing the host to input custom words for the game.
 * @param param0 the component props including `isOpen`, `initialWords`, `isGenerating`, `onGenerateTheme`, `onClose`, and `onSave`.
 * @returns
 */
export const CustomWordsDrawer = ({
  isOpen,
  initialWords,
  isGenerating,
  onGenerateTheme,
  onClose,
  onSave,
}: CustomWordsDrawerProps) => {
  const [input, setInput] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<'manual' | 'ai' | null>(null);
  const [manualShake, setManualShake] = useState(false);
  const [aiShake, setAiShake] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);

  const prevIsGenerating = useRef(isGenerating);
  // Hydrate when it opens
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setInput(initialWords.join('\n'));
      setError(null);
    }
  }

  // Hydrate dynamically if AI just finished while the drawer was open
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating) {
      // Transitioned from generating to finished -> overwrite textarea with new words
      setInput(initialWords.join('\n'));
      setThemeInput(''); // Clear the prompt input on success
    }
    prevIsGenerating.current = isGenerating;
  }, [isGenerating, initialWords]);

  const triggerShake = (target: 'manual' | 'ai') => {
    if (target === 'manual') {
      setManualShake(true);
      setTimeout(() => setManualShake(false), 400);
    } else {
      setAiShake(true);
      setTimeout(() => setAiShake(false), 400);
    }
  };

  const handleGenerateClick = () => {
    if (themeInput.trim().length < 3) {
      setError('Theme prompt must be at least 3 characters.');
      setErrorSource('ai');
      triggerShake('ai');
      return;
    }

    if (!isGenerating) {
      setError(null);
      setErrorSource(null);
      onGenerateTheme(themeInput.trim());
    }
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
      setErrorSource('manual');
      triggerShake('manual');
      return;
    }

    const overLengthWord = words.find((w) => w.length > GAME_CONSTANTS.MAX_WORD_LENGTH);
    if (overLengthWord) {
      setError(
        `Words cannot exceed ${GAME_CONSTANTS.MAX_WORD_LENGTH} characters ("${overLengthWord.substring(0, 10)}...").`,
      );
      setErrorSource('manual');
      triggerShake('manual');
      return;
    }

    const tooManyWordsPhrase = words.find(
      (w) => w.split(/\s+/).filter(Boolean).length > GAME_CONSTANTS.MAX_WORDS_PER_PHRASE,
    );
    if (tooManyWordsPhrase) {
      setError(
        `Phrases can have at most ${GAME_CONSTANTS.MAX_WORDS_PER_PHRASE} words ("${tooManyWordsPhrase.substring(0, 15)}...").`,
      );
      setErrorSource('manual');
      triggerShake('manual');
      return;
    }

    setError(null);
    setErrorSource(null);
    onSave(words);
  };

  /**
   * Updates the textarea input state and clears any existing validation error.
   * @param {string} val - The new textarea content.
   * @returns {void}
   */
  const handleInputChange = (val: string) => {
    setInput(val);
    if (error) {
      setError(null);
      setErrorSource(null);
    }
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
            className="w-full md:max-w-2xl h-[90vh] md:h-auto md:max-h-[85vh] bg-white dark:bg-discord-card rounded-t-3xl md:rounded-4xl border-t-4 md:border-4 border-gray-200 dark:border-discord-main shadow-2xl flex flex-col absolute bottom-0 md:relative overflow-hidden"
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
                  <p className="text-[10px] md:text-xs text-gray-500 font-bold mt-0.5">
                    <span className="text-gray-700 dark:text-gray-300">
                      Generate a themed list with AI, or type manually below.
                    </span>
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            {/* Drawer Body*/}
            <div className="flex-1 p-5 md:p-6 overflow-hidden flex flex-col gap-3 md:gap-4">
              {/* 1. Manual Text Area (TOP) */}
              <motion.div
                className="flex-1 flex flex-col min-h-30 relative"
                animate={{ x: manualShake ? [-10, 10, -10, 10, 0] : 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex flex-col mb-2 px-1">
                  <div className="flex items-center gap-2">
                    <Edit3
                      size={16}
                      className="text-green-500 dark:text-neon-blue"
                      strokeWidth={2.5}
                    />
                    <span className="font-black text-sm text-gray-700 dark:text-gray-300">
                      Manual Entry
                    </span>
                  </div>
                  <span className="text-[10px] text-gray-500 dark:text-gray-400 font-bold mt-1">
                    Separate by{' '}
                    <strong className="text-green-500 dark:text-neon-blue">commas (,)</strong> or
                    new lines. Max {GAME_CONSTANTS.MAX_WORDS_PER_PHRASE} words per phrase (
                    {GAME_CONSTANTS.MAX_WORD_LENGTH} character limit total).
                  </span>
                </div>
                <textarea
                  disabled={isGenerating}
                  value={input}
                  onChange={(e) => handleInputChange(e.target.value)}
                  placeholder="apple, banana, rocket ship, pizza..."
                  className={`flex-1 w-full p-4 border-4 rounded-2xl font-mono text-sm resize-none focus:outline-none transition-colors scrollbar-none [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden disabled:opacity-50 ${
                    error && errorSource === 'manual'
                      ? 'border-red-500 focus:border-red-600 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                      : 'bg-gray-50 dark:bg-[#111214] border-gray-200 dark:border-gray-700 focus:border-green-500 dark:focus:border-neon-blue text-gray-900 dark:text-gray-100'
                  }`}
                />

                {error && errorSource === 'manual' && (
                  <span className="text-red-500 dark:text-red-400 font-bold text-xs mt-2 px-1 animate-in fade-in slide-in-from-top-1">
                    {error}
                  </span>
                )}

                {/* Overlay that blocks the textarea while generating*/}
                <AnimatePresence>
                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white/50 dark:bg-[#111214]/60 backdrop-blur-[1px] rounded-2xl flex items-center justify-center z-10"
                    >
                      <div className="bg-white dark:bg-discord-card shadow-xl border-2 border-red-200 dark:border-neon-pink/30 px-5 md:px-6 py-3 md:py-4 rounded-2xl flex items-center gap-3">
                        <Loader2
                          size={24}
                          className="text-red-500 dark:text-neon-pink animate-spin"
                          strokeWidth={3}
                        />
                        <span className="font-black text-gray-700 dark:text-gray-200">
                          AI is thinking...
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* 2. The "OR" Divider */}
              <div className="flex items-center gap-4 shrink-0 py-1">
                <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
                <span className="font-black text-xs text-gray-400 dark:text-gray-500 tracking-widest uppercase">
                  OR
                </span>
                <div className="flex-1 h-0.5 bg-gray-200 dark:bg-gray-800 rounded-full"></div>
              </div>

              {/* 3. AI Theme Generation Section */}
              <motion.div
                className="bg-red-50 dark:bg-[#111214] border-2 border-red-100 dark:border-neon-pink/30 p-3 md:p-4 rounded-2xl shrink-0"
                animate={{ x: aiShake ? [-10, 10, -10, 10, 0] : 0 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles
                    size={16}
                    className="text-red-500 dark:text-neon-pink"
                    strokeWidth={2.5}
                  />
                  <span className="font-black text-sm text-red-900 dark:text-white">
                    Generate with AI
                  </span>
                </div>
                <div className="flex flex-col md:flex-row gap-2 md:gap-3">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      disabled={isGenerating}
                      maxLength={GAME_CONSTANTS.AI_THEME_MAX_CHARS}
                      value={themeInput}
                      onChange={(e) => {
                        setThemeInput(e.target.value);
                        if (error) setError(null); // Clear error on typing
                      }}
                      placeholder="Describe your theme..."
                      className={`w-full bg-white dark:bg-discord-card border-2 focus:border-red-500 dark:focus:border-neon-pink text-gray-900 dark:text-white rounded-xl pl-3 pr-14 md:pl-4 md:pr-16 py-2.5 md:py-3 text-sm font-bold outline-none transition-all disabled:opacity-50 ${
                        error && errorSource === 'ai'
                          ? 'border-red-500 dark:border-neon-pink'
                          : 'border-red-200 dark:border-gray-700'
                      }`}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">
                      {themeInput.length}/{GAME_CONSTANTS.AI_THEME_MAX_CHARS}
                    </span>
                  </div>
                  <button
                    onClick={handleGenerateClick}
                    // Button remains clickable so it can trigger the validation error & shake
                    disabled={isGenerating}
                    className="flex items-center justify-center gap-2 px-4 md:px-6 py-2.5 md:py-3 rounded-xl font-black text-white bg-red-500 dark:bg-neon-pink hover:bg-red-600 dark:hover:bg-pink-600 border-b-4 border-red-700 dark:border-pink-900 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:border-b-4 disabled:active:translate-y-0 shrink-0"
                  >
                    {isGenerating ? (
                      <>
                        <Loader2 size={16} strokeWidth={3} className="animate-spin" /> Wait...
                      </>
                    ) : (
                      'Generate'
                    )}
                  </button>
                </div>
                {error && errorSource === 'ai' && (
                  <span className="text-red-500 dark:text-red-600 font-bold text-xs mt-2 animate-in fade-in slide-in-from-top-1">
                    {error}
                  </span>
                )}
              </motion.div>
            </div>

            {/* Drawer Footer */}
            <div className="p-5 md:p-6 border-t-2 border-gray-100 dark:border-gray-800 shrink-0 flex gap-3">
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="flex-1 py-3 rounded-xl font-black text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isGenerating}
                className="flex-2 py-3 rounded-xl font-black text-white bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover border-b-4 border-green-700 dark:border-blue-900 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:border-b-4 disabled:active:translate-y-0"
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
