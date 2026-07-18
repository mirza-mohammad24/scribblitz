'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';
import { ServerEvents } from '@scribblitz/types';
import { EmoteMessage } from '@/store/gameStore';

// Extend the store type locally to include our randomized animation math
interface AnimatedEmote extends EmoteMessage {
  swayAmount: number;
  rotationStart: number;
  originY: number; // will add more randomness
}

const FLIGHT_DURATION_S = 1.1;

export const FloatingEmotes = () => {
  const { socket } = useGameSocket();
  const { players } = useGameStore();
  const [activeEmotes, setActiveEmotes] = useState<AnimatedEmote[]>([]);

  useEffect(() => {
    if (!socket) return;

    const handleEmoteBroadcast = (payload: EmoteMessage) => {
      const swayAmount = Math.floor(Math.random() * 40) - 20;
      const rotationStart = Math.floor(Math.random() * 20) - 10;
      const originY = Math.floor(Math.random() * 24);

      //Add the new emote to the screen
      setActiveEmotes((prev) => [
        ...prev,
        {
          ...payload,
          swayAmount,
          rotationStart,
          originY,
        },
      ]);
    };
    socket.on(ServerEvents.EMOTE_BROADCAST, handleEmoteBroadcast);

    return () => {
      socket.off(ServerEvents.EMOTE_BROADCAST, handleEmoteBroadcast);
    };
  }, [socket]);

  const removeEmote = (id: string) => {
    setActiveEmotes((prev) => prev.filter((emote) => emote.id !== id));
  };

  return (
    <div className="absolute inset-0 z-40 pointer-events-none overflow-hidden rounded-3xl">
      <AnimatePresence>
        {activeEmotes.map((emote) => {
          const sender = players.find((p) => p.id === emote.senderId);

          return (
            <motion.div
              key={emote.id}
              initial={{ opacity: 0, y: 0, scale: 0.2, rotate: emote.rotationStart }}
              animate={{
                opacity: [0, 1, 1, 1, 0],
                y: [0, -30, -70, -140, -180],
                x: [0, emote.swayAmount, emote.swayAmount * 0.5, 0, 0],
                scale: [0.2, 1.6, 1.15, 1.05, 0.9],
                rotate: [emote.rotationStart, emote.rotationStart * -0.3, 0, 0, 0],
              }}
              exit={{ opacity: 0, scale: 1.3, transition: { duration: 0.12 } }}
              transition={{
                duration: FLIGHT_DURATION_S,
                times: [0, 0.18, 0.4, 0.7, 1],
                ease: ['circOut', 'easeOut', 'linear', 'easeIn'],
              }}
              onAnimationComplete={() => removeEmote(emote.id)}
              className="absolute bottom-10 flex flex-col items-center gap-1"
              style={{ left: `${emote.startX}%`, bottom: `${40 + emote.originY}px` }}
            >
              <span className="text-5xl md:text-6xl drop-shadow-2xl leading-none">
                {emote.emoji}
              </span>

              {sender && (
                <span className="bg-black/60 dark:bg-black/70 text-white text-[10px] md:text-xs font-black px-2 py-0.5 rounded-full backdrop-blur-sm whitespace-nowrap shadow-md">
                  {sender.username}
                </span>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
};
