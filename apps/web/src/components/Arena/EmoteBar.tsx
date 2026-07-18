'use client';

import { useGameSocket } from '@/hooks/useGameSocket';
import { ClientEvents } from '@scribblitz/types';
import { motion } from 'framer-motion';

// Configure which emojis show up on mobile vs desktop
const EMOTES = [
  { char: '👍', mobile: true },
  { char: '👎', mobile: true },
  { char: '❤️', mobile: true },
  { char: '🔥', mobile: true },
  { char: '😂', mobile: false },
  { char: '😭', mobile: false },
  { char: '🤯', mobile: false },
];

export const EmoteBar = () => {
  const { socket } = useGameSocket();

  const handleSendEmote = (emoji: string) => {
    if (!socket) return;
    socket.emit(ClientEvents.EMOTE_SEND, { emoji });
  };

  return (
    <div className="flex gap-1.5 md:gap-1 w-full py-2 px-2 md:px-3 bg-gray-50 dark:bg-discord-card border-t-2 border-gray-100 dark:border-discord-main shrink-0 justify-start md:justify-between overflow-x-auto hide-scrollbar">
      {EMOTES.map(({ char, mobile }) => (
        <motion.button
          key={char}
          whileTap={{ scale: 0.75 }}
          onClick={() => handleSendEmote(char)}
          className={`shrink-0 w-9 h-9 md:w-9.5 md:h-9.5 bg-white dark:bg-discord-main border-2 border-gray-200 dark:border-gray-800 rounded-full shadow-sm items-center justify-center text-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
            !mobile ? 'hidden md:flex' : 'flex'
          }`}
        >
          {char}
        </motion.button>
      ))}
    </div>
  );
};
