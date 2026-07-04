'use client';

/**
 * @file ArenaChat.tsx — Real-time chat / guess panel for the game arena.
 *
 * This component renders a scrollable message list and an input form for
 * submitting guesses during a drawing round. It supports three message
 * visual styles:
 * - User messages: Bubble-style, right-aligned for the sender, left for others.
 * - System messages: Centered banners (e.g. "Player X guessed the word!").
 * - Close guess alerts: Amber-styled system banners indicating a near-miss.
 *
 * Smart scroll behaviour:
 * - Auto-scrolls to the newest message when the user is near the bottom or
 *   sends their own message.
 * - Shows a floating "New messages" badge when the user has scrolled up and
 *   new messages arrive, to avoid jarring scroll jumps.
 *
 * Desktop UX enhancement:
 * - A global `keydown` listener auto-focuses the chat input when the user
 *   starts typing alphanumeric characters (unless they are the drawer or
 *   already focused on another input).
 *
 * Security:
 * - The active drawer's input is disabled and cannot submit guesses.
 * - Messages include the current `roundId` to prevent cross-round leaks.
 *
 * @see {@link ArenaOrchestrator} — parent that renders this component
 */

import { useState, useRef, useEffect } from 'react';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';
import { ClientEvents } from '@scribblitz/types';
import { SendHorizontal, ChevronDown, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * Real-time chat and guess submission panel for the game arena.
 *
 * Renders a scrollable list of chat/system messages with spring-animated
 * entry transitions, a floating unread-message badge, and a submission form
 * that is disabled for the active drawer.
 *
 * @returns The chat panel with message list, unread badge, and input form.
 */
export const ArenaChat = () => {
  const { socket, userId } = useGameSocket();
  const { chatMessages, roundId, currentDrawerId } = useGameStore();

  const [message, setMessage] = useState('');

  // Added refs for both the container and the target
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [hasUnread, setHasUnread] = useState(false);

  // Security check: The active drawer is not allowed to use the chat
  const isDrawer = userId === currentDrawerId;

  /**
   * Smoothly scrolls the chat container to the bottom after a short delay.
   * The 50 ms timeout allows Framer Motion to finish rendering newly animated
   * message elements before measuring scroll height.
   */
  const scrollToBottom = () => {
    // A slight delay ensures Framer Motion has time to render the new element's height
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      setHasUnread(false);
    }, 50);
  };

  /**
   * Handles the scroll event on the chat container to detect when the user
   * manually scrolls back to the bottom. Clears the unread-message badge
   * when the user is within 50 px of the container's scroll end.
   */
  // Track if the user manually scrolled to the bottom to clear the "Unread" badge
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;

    // If user is within 50px of the bottom, clear the unread badge
    if (scrollHeight - scrollTop - clientHeight < 50) {
      setHasUnread(false);
    }
  };

  // Smart Auto-scroll to the bottom whenever a new message arrives
  useEffect(() => {
    if (!scrollContainerRef.current) return;

    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;

    // Check if the user sent the message themselves
    const isMyMessage = chatMessages[chatMessages.length - 1]?.senderId === userId;

    if (isNearBottom || isMyMessage) {
      scrollToBottom();
    } else {
      // Violent scroll prevented. Show the unread banner instead.
      setHasUnread(true);
    }
  }, [chatMessages, userId]);

  // Global Keyboard Listener: Auto-focus the chat when typing starts (Desktop UX)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't steal focus if they are using hotkeys, already in an input, or are the drawer
      if (
        isDrawer ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        document.activeElement?.tagName === 'INPUT'
      )
        return;

      // If it's a standard character/number, focus the chat box
      if (e.key.length === 1 && /[a-zA-Z0-9]/.test(e.key)) {
        inputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawer]);

  /**
   * Handles the chat form submission.
   * Prevents default form behaviour, trims the input, emits the
   * {@link ClientEvents.CHAT_MESSAGE} event with the current `roundId`
   * to the server, clears the input, and snaps the scroll to the bottom.
   *
   * @param e - The form submission event.
   */
  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !socket || isDrawer) return;

    // Emit the message to the server, attaching the roundId to prevent cross-round leaks
    socket.emit(ClientEvents.CHAT_MESSAGE, { message: message.trim(), roundId });
    setMessage('');

    // Force snap-to-bottom the exact millisecond you hit send
    scrollToBottom();
  };

  return (
    <div className="flex flex-col h-full w-full flex-1 min-h-0 bg-gray-50 dark:bg-discord-card border-4 border-gray-200 dark:border-discord-main rounded-3xl overflow-hidden shadow-sm relative transition-colors">
      {/* Header */}
      <div className="bg-green-500 dark:bg-neon-blue text-white px-4 py-3 font-black text-sm tracking-widest uppercase text-center border-b-4 border-green-600 dark:border-blue-900 shrink-0 shadow-sm z-10">
        Live Guesses
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 p-3 md:p-4 overflow-y-auto custom-scrollbar flex flex-col gap-2.5 relative"
      >
        <AnimatePresence initial={false}>
          {chatMessages.map((msg, idx) => {
            const isCorrectGuess = msg.isSystem && msg.message.toLowerCase().includes('guessed');
            const isCloseGuess = msg.isSystem && msg.isCloseGuess === true;

            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                className={`
                  ${msg.isSystem ? 'w-full my-1' : 'max-w-[85%] px-3 py-2 text-sm font-medium shadow-sm'}
                  ${
                    msg.isSystem
                      ? // PREMIUM SYSTEM MESSAGE STYLING
                        isCorrectGuess
                        ? 'bg-green-100 dark:bg-blue-900/30 text-green-700 dark:text-neon-blue font-black self-center text-center border-2 border-green-400 dark:border-neon-blue rounded-xl px-4 py-2 flex items-center justify-center gap-2 drop-shadow-sm'
                        : isCloseGuess
                          ? //AMBER STYLING FOR CLOSE GUESSES
                            'bg-amber-100 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 font-black self-center text-center border-2 border-amber-400 dark:border-amber-600 rounded-xl px-4 py-2 flex items-center justify-center gap-2 drop-shadow-sm'
                          : 'bg-yellow-100 dark:bg-discord-main text-yellow-800 dark:text-gray-300 font-bold self-center text-center border-2 border-yellow-300 dark:border-gray-700 rounded-xl px-4 py-2 text-xs'
                      : msg.senderId === userId
                        ? 'bg-green-500 dark:bg-neon-blue text-white self-end rounded-2xl rounded-br-sm'
                        : 'bg-white dark:bg-discord-main border-2 border-gray-100 dark:border-gray-800 dark:text-gray-200 self-start rounded-2xl rounded-bl-sm'
                  }
                `}
              >
                {/* SPARKLES FOR CORRECT GUESSES */}
                {isCorrectGuess && (
                  <Sparkles
                    size={16}
                    className="text-green-500 dark:text-neon-blue animate-pulse"
                  />
                )}

                {!msg.isSystem && (
                  <span
                    className={`font-black text-[10px] block mb-0.5 ${
                      msg.senderId === userId
                        ? 'text-green-100 dark:text-blue-900'
                        : 'text-gray-400 dark:text-gray-500'
                    }`}
                  >
                    {msg.senderName}
                  </span>
                )}
                <span className={`${msg.isSystem ? '' : 'wrap-break-word'}`}>{msg.message}</span>

                {/* SPARKLES FOR CORRECT GUESSES */}
                {isCorrectGuess && (
                  <Sparkles
                    size={16}
                    className="text-green-500 dark:text-neon-blue animate-pulse"
                  />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
        <div ref={messagesEndRef} className="shrink-0" />
      </div>

      <AnimatePresence>
        {hasUnread && (
          <motion.button
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            onClick={scrollToBottom}
            className="absolute bottom-18 left-1/2 -translate-x-1/2 bg-red-500 dark:bg-neon-pink text-white px-4 py-1.5 rounded-full font-black text-xs shadow-xl flex items-center gap-1 border-2 border-white dark:border-discord-main z-10 hover:bg-red-600 transition-colors"
          >
            New messages <ChevronDown size={14} strokeWidth={3} />
          </motion.button>
        )}
      </AnimatePresence>

      <form
        onSubmit={handleSend}
        className="p-3 bg-white dark:bg-discord-card border-t-4 border-gray-200 dark:border-discord-main flex gap-2 shrink-0 z-20 relative w-full"
      >
        <input
          ref={inputRef}
          type="text"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          disabled={isDrawer}
          placeholder={isDrawer ? "Drawers can't chat!" : 'Type guess...'}
          className="flex-1 min-w-0 px-4 py-2 bg-gray-100 dark:bg-discord-main border-2 border-gray-200 dark:border-gray-800 rounded-xl font-bold text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:border-green-500 dark:focus:border-neon-blue disabled:opacity-50 transition-colors"
        />
        <motion.button
          whileTap={{ scale: 0.95 }}
          type="submit"
          disabled={isDrawer || !message.trim()}
          className="shrink-0 bg-green-500 dark:bg-neon-blue hover:bg-green-600 text-white px-4 rounded-xl font-black disabled:opacity-50 border-b-4 border-green-700 dark:border-blue-900 active:border-b-0 active:translate-y-1 transition-all flex items-center justify-center"
        >
          <SendHorizontal size={18} strokeWidth={2.5} />
        </motion.button>
      </form>
    </div>
  );
};
