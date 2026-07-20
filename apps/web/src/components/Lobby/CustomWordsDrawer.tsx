'use client';

/**
 * @module CustomWordsDrawer
 * @description A slide-up drawer modal that allows the host to input custom words
 * for the game and AI-generated themes. Words can be separated by commas or new lines. Validates word
 * count limits, individual word length, and words-per-phrase constraints before
 * saving. Matches Zod schema constraints to prevent server-side rejection.
 */

import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence, PanInfo } from 'framer-motion';
import { BookOpen, X, Sparkles, Loader2, Edit3 } from 'lucide-react';
import { GAME_CONSTANTS } from '@scribblitz/shared';

// Array of progressive loading messages to display while AI is generating
const LOADING_MESSAGES = [
  'Waking up the AI...',
  'Brainstorming themed words...',
  'Consulting the dictionary...',
  'Filtering out the boring stuff...',
  'Polishing the final list...',
  'Taking a bit longer than usual...',
  'Hang tight, almost done...',
];

type TabType = 'manual' | 'ai';

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
 * @param param0 the component props including `isOpen`, `initialWords`, `isGenerating`,
 * `onGenerateTheme`, `onClose`, and `onSave`.
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
  const [activeTab, setActiveTab] = useState<TabType>('manual'); //for mobile phone view, to switch between manual and AI tabs
  const [input, setInput] = useState('');
  const [themeInput, setThemeInput] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [errorSource, setErrorSource] = useState<'manual' | 'ai' | null>(null);
  const [manualShake, setManualShake] = useState(false);
  const [aiShake, setAiShake] = useState(false);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  // State to track which loading message to show
  const [loadingMessageIdx, setLoadingMessageIdx] = useState(0);

  const prevIsGenerating = useRef(isGenerating);
  // Hydrate when it opens
  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setInput(initialWords.join('\n'));
      setError(null);
      setActiveTab('manual'); // Always open on manual tab
    }
  }

  // Hydrate dynamically and Auto-Switch tab when AI finishes
  useEffect(() => {
    if (prevIsGenerating.current && !isGenerating) {
      // Transitioned from generating to finished -> overwrite textarea with new words
      setInput(initialWords.join('\n'));
      setThemeInput(''); // Clear the prompt input on success
      setActiveTab('manual'); //Auto-switch to manual tab when AI finishes generating
    }
    prevIsGenerating.current = isGenerating;
  }, [isGenerating, initialWords]);

  // Manage the dynamic loading messages
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isGenerating) {
      interval = setInterval(() => {
        setLoadingMessageIdx((prev) => {
          // Stop at the last message to avoid awkward looping if it hits the 60s max
          if (prev < LOADING_MESSAGES.length - 1) return prev + 1;
          return prev;
        });
      }, 8000); // Change message every 8 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isGenerating]);

  // Handle Swipe-to-Close for Mobile
  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.y > 50 || info.velocity.y > 200) {
      if (!isGenerating) onClose();
    }
  };

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
      setLoadingMessageIdx(0);
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
      setActiveTab('manual');
      triggerShake('manual');
      return;
    }

    const overLengthWord = words.find((w) => w.length > GAME_CONSTANTS.MAX_WORD_LENGTH);
    if (overLengthWord) {
      setError(
        `Words cannot exceed ${GAME_CONSTANTS.MAX_WORD_LENGTH} characters ("${overLengthWord.substring(0, 10)}...").`,
      );
      setErrorSource('manual');
      setActiveTab('manual');
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
      setActiveTab('manual');
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
            drag="y" // Enables vertical dragging
            dragConstraints={{ top: 0 }} // Prevents dragging upwards
            dragElastic={{ top: 0, bottom: 0.8 }}
            onDragEnd={handleDragEnd}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            // Height is bounded to 85dvh so it never hits the mobile URL bar
            className="w-full md:max-w-xl h-auto max-h-[85dvh] bg-white dark:bg-discord-card rounded-t-3xl md:rounded-4xl border-t-4 md:border-4 border-gray-200 dark:border-discord-main shadow-2xl flex flex-col absolute bottom-0 md:relative overflow-hidden"
          >
            {/* Mobile Drag Handle */}
            <div className="w-full pt-3 pb-1 flex justify-center md:hidden shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-12 h-1.5 bg-gray-300 dark:bg-gray-600 rounded-full" />
            </div>
            {/* Drawer Header */}
            <div className="flex justify-between items-center px-5 md:px-6 pb-4 md:py-6 border-b-2 border-gray-100 dark:border-gray-800 shrink-0">
              <div className="flex items-center gap-3 pointer-events-none">
                <div className="p-2 bg-green-100 dark:bg-neon-blue/20 rounded-xl text-green-600 dark:text-neon-blue">
                  <BookOpen size={20} strokeWidth={2.5} />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black text-gray-900 dark:text-white leading-none">
                    Custom Words
                  </h2>
                  <p className="text-[10px] md:text-xs text-gray-500 font-bold mt-0.5">
                    <span className="text-gray-700 dark:text-gray-300">
                      Generate a themed list with AI, or type manually below.
                    </span>
                  </p>
                </div>
              </div>

              {/* Desktop Only 'X' Button */}
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="hidden md:block p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors bg-gray-100 dark:bg-gray-800 rounded-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <X size={20} strokeWidth={3} />
              </button>
            </div>

            {/* Drawer Body */}
            <div className="flex-1 p-5 md:p-6 overflow-hidden flex flex-col">
              {/* The Tab Toggle */}
              <div className="flex p-1 bg-gray-100 dark:bg-[#111214] rounded-xl mb-5 shrink-0 border-2 border-gray-200 dark:border-gray-800">
                <button
                  onClick={() => setActiveTab('manual')}
                  disabled={isGenerating}
                  className={`flex-1 py-2 font-black text-sm rounded-lg transition-all ${
                    activeTab === 'manual'
                      ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Edit3 size={16} /> Manual
                  </span>
                </button>
                <button
                  onClick={() => setActiveTab('ai')}
                  disabled={isGenerating}
                  className={`flex-1 py-2 font-black text-sm rounded-lg transition-all ${
                    activeTab === 'ai'
                      ? 'bg-white dark:bg-gray-700 text-red-600 dark:text-neon-pink shadow-sm'
                      : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
                >
                  <span className="flex items-center justify-center gap-2">
                    <Sparkles size={16} /> AI Gen
                  </span>
                </button>
              </div>

              {/* Dynamic Content Area */}
              <div className="flex-1 relative overflow-hidden flex flex-col">
                {/* 1. MANUAL TAB */}
                {activeTab === 'manual' && (
                  <motion.div
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: 1,
                      x: manualShake ? [-10, 10, -10, 10, 0] : 0,
                    }}
                    className="flex-1 flex flex-col relative h-full"
                    transition={{ duration: 0.3 }}
                  >
                    <p className="text-[11px] text-gray-500 dark:text-gray-400 font-bold mb-2">
                      Separate by{' '}
                      <strong className="text-green-500 dark:text-neon-blue">commas (,)</strong> or
                      new lines. Max {GAME_CONSTANTS.MAX_WORDS_PER_PHRASE} words per phrase (
                      {GAME_CONSTANTS.MAX_WORD_LENGTH} character limit total).
                    </p>
                    <textarea
                      disabled={isGenerating}
                      value={input}
                      onChange={(e) => handleInputChange(e.target.value)}
                      placeholder="apple, banana, rocket ship, pizza..."
                      className={`flex-1 min-h-37.5 w-full p-4 border-4 rounded-2xl font-mono text-sm resize-none focus:outline-none transition-colors scrollbar-none disabled:opacity-50 ${
                        error && errorSource === 'manual'
                          ? 'border-red-500 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                          : 'bg-gray-50 dark:bg-[#111214] border-gray-200 dark:border-gray-700 focus:border-green-500 dark:focus:border-neon-blue text-gray-900 dark:text-gray-100'
                      }`}
                    />
                    {error && errorSource === 'manual' && (
                      <span className="text-red-500 dark:text-red-400 font-bold text-xs mt-2 animate-in fade-in slide-in-from-top-1">
                        {error}
                      </span>
                    )}
                  </motion.div>
                )}

                {/* 2. AI TAB */}
                {activeTab === 'ai' && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{
                      opacity: 1,
                      x: aiShake ? [-10, 10, -10, 10, 0] : 0,
                    }}
                    className="flex flex-col relative h-full justify-center"
                    transition={{ duration: 0.3 }}
                  >
                    <div className="bg-red-50 dark:bg-[#111214] border-2 border-red-100 dark:border-neon-pink/30 p-4 md:p-5 rounded-2xl">
                      <p className="text-xs text-red-800 dark:text-gray-300 font-bold mb-3">
                        Describe a theme, and AI will generate perfect words for you.
                      </p>

                      <div className="relative mb-3">
                        <input
                          type="text"
                          disabled={isGenerating}
                          maxLength={GAME_CONSTANTS.AI_THEME_MAX_CHARS}
                          value={themeInput}
                          onChange={(e) => {
                            setThemeInput(e.target.value);
                            if (error) setError(null);
                          }}
                          placeholder="e.g. Marvel superheroes..."
                          className={`w-full bg-white dark:bg-discord-card border-2 focus:border-red-500 dark:focus:border-neon-pink text-gray-900 dark:text-white rounded-xl pl-4 pr-16 py-3 text-sm font-bold outline-none transition-all disabled:opacity-50 ${
                            error && errorSource === 'ai'
                              ? 'border-red-500 dark:border-neon-pink'
                              : 'border-red-200 dark:border-gray-700'
                          }`}
                        />
                        <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-gray-400 pointer-events-none">
                          {themeInput.length}/{GAME_CONSTANTS.AI_THEME_MAX_CHARS}
                        </span>
                      </div>

                      <button
                        onClick={handleGenerateClick}
                        disabled={isGenerating}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-white bg-red-500 dark:bg-neon-pink hover:bg-red-600 dark:hover:bg-pink-600 border-b-4 border-red-700 dark:border-pink-900 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:border-b-4 disabled:active:translate-y-0"
                      >
                        {isGenerating ? (
                          <>
                            <Loader2 size={18} strokeWidth={3} className="animate-spin" />{' '}
                            Generating...
                          </>
                        ) : (
                          'Generate Words'
                        )}
                      </button>

                      {error && errorSource === 'ai' && (
                        <div className="text-center mt-2">
                          <span className="text-red-500 dark:text-red-600 font-bold text-xs animate-in fade-in">
                            {error}
                          </span>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Global Loading Overlay (Covers both tabs while active) */}
                <AnimatePresence>
                  {isGenerating && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="absolute inset-0 bg-white/60 dark:bg-[#111214]/70 backdrop-blur-[2px] flex items-center justify-center z-10 rounded-xl"
                    >
                      <div className="bg-white dark:bg-discord-card shadow-xl border-2 border-red-200 dark:border-neon-pink/30 px-6 py-4 rounded-2xl flex items-center gap-3 overflow-hidden max-w-[90%]">
                        <Loader2
                          size={24}
                          className="text-red-500 dark:text-neon-pink animate-spin shrink-0"
                          strokeWidth={3}
                        />
                        <AnimatePresence mode="wait">
                          <motion.span
                            key={loadingMessageIdx}
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -5 }}
                            transition={{ duration: 0.2 }}
                            className="font-black text-sm text-gray-700 dark:text-gray-200"
                          >
                            {LOADING_MESSAGES[loadingMessageIdx]}
                          </motion.span>
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Drawer Footer */}
            <div className="p-4 md:p-6 border-t-2 border-gray-100 dark:border-gray-800 shrink-0 flex gap-3">
              {/* Desktop Only 'Cancel' Button */}
              <button
                onClick={onClose}
                disabled={isGenerating}
                className="hidden md:block flex-1 py-3.5 rounded-xl font-black text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>

              {/* 'Save List' Button (Full width on mobile, flex-2 on desktop) */}
              <button
                onClick={handleSave}
                disabled={isGenerating}
                className="w-full md:flex-2 py-3.5 rounded-xl font-black text-white bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover border-b-4 border-green-700 dark:border-blue-900 active:border-b-0 active:translate-y-1 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:border-b-4 disabled:active:translate-y-0"
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
