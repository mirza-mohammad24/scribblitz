'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { X, Gamepad2, Users, Brush, MessageSquare, Trophy } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal = ({ isOpen, onClose }: RulesModalProps) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm cursor-pointer"
          />

          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="w-full max-w-xl bg-white dark:bg-discord-card rounded-[2rem] border-4 border-gray-200 dark:border-discord-main p-6 md:p-8 shadow-2xl flex flex-col gap-6 relative pointer-events-auto"
            >
              <button
                onClick={onClose}
                className="absolute top-6 right-6 text-gray-400 hover:text-red-500 dark:hover:text-neon-pink transition-colors bg-gray-100 dark:bg-discord-main p-2 rounded-full active:scale-95"
              >
                <X size={20} strokeWidth={3} />
              </button>

              <div className="flex items-center gap-3 border-b-2 border-gray-100 dark:border-discord-main pb-4 mt-2">
                <div className="bg-green-100 dark:bg-neon-blue/20 p-2.5 rounded-xl text-green-600 dark:text-neon-blue">
                  <Gamepad2 size={24} strokeWidth={2.5} />
                </div>
                <h2 className="text-2xl md:text-3xl font-black text-gray-900 dark:text-gray-100 tracking-tight">
                  How to Play
                </h2>
              </div>

              <div className="flex flex-col gap-5">
                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-500 font-black shrink-0 border-2 border-green-200 dark:border-green-800">
                    <Users size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800 dark:text-gray-200">Join a Room</h4>
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      Create a private room and share the 6-letter code with your friends, or join
                      their room directly.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-500 font-black shrink-0 border-2 border-blue-200 dark:border-blue-800">
                    <Brush size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800 dark:text-gray-200">Draw the Word</h4>
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      When it is your turn, you will get 3 words to choose from. Draw it as best as
                      you can without spelling it out!
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-500 font-black shrink-0 border-2 border-purple-200 dark:border-purple-800">
                    <MessageSquare size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800 dark:text-gray-200">Guess Fast</h4>
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      If someone else is drawing, type your guesses in the chat. The faster you
                      guess the word, the more points you get.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4 items-start">
                  <div className="w-8 h-8 rounded-full bg-yellow-50 dark:bg-yellow-900/20 flex items-center justify-center text-yellow-500 font-black shrink-0 border-2 border-yellow-200 dark:border-yellow-800">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <h4 className="font-black text-gray-800 dark:text-gray-200">Win the Game</h4>
                    <p className="text-sm font-bold text-gray-500 mt-1">
                      The player with the most points at the end of all rounds takes the crown.
                      Simple, chaotic and fun!
                    </p>
                  </div>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-full mt-2 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white py-3.5 rounded-xl font-black text-lg border-b-[4px] border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 transition-all shadow-sm"
              >
                Got it! Let&apos;s Draw
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};
