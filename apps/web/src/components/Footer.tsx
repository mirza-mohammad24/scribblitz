'use client';

/**
 * @module Footer
 * @description A desktop-only site footer displayed on the HomeScreen. Contains
 * brand information, a "How to Play" rules modal trigger, and an animated tech
 * stack marquee powered by {@link LogoLoop}. Automatically hides when the user
 * is in the Lobby or Arena game states.
 */

import { useState } from 'react';
import { Brush, ScrollText } from 'lucide-react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import LogoLoop from '@/components/ReactBits/LogoLoop';
import { RulesModal } from '@/components/ui/RulesModal';
import { useGameStore } from '@/store/gameStore';

/**
 * Renders the site footer with brand info, explore links, a tech stack marquee,
 * copyright notice, and social links. Returns `null` when the game is active
 * (i.e., `gameState` is not `null`) to keep the UI focused on gameplay.
 * @returns {React.JSX.Element | null} The footer JSX or null if the game is active.
 */
export const Footer = () => {
  const gameState = useGameStore((state) => state.gameState);
  const [isRulesOpen, setIsRulesOpen] = useState(false);

  // Instantly hide the footer completely if the user is in the Lobby or Arena
  if (gameState !== null) {
    return null;
  }

  // Tech Stack matching our exact technologies and their official brand colors
  const techStack = [
    {
      node: (
        <span className="font-black text-gray-900 dark:text-white tracking-tight">Next.js 15</span>
      ),
    },
    { node: <span className="font-black text-[#61DAFB] tracking-tight">React 19</span> },
    { node: <span className="font-black text-[#3178C6] tracking-tight">TypeScript</span> },
    { node: <span className="font-black text-[#339933] tracking-tight">Node.js</span> },
    {
      node: (
        <span className="font-black text-gray-800 dark:text-gray-200 tracking-tight">
          Socket.IO
        </span>
      ),
    },
    { node: <span className="font-black text-[#FF4154] tracking-tight">Turbopack</span> },
    { node: <span className="font-black text-[#0055FF] tracking-tight">Framer Motion</span> },
  ];

  return (
    <>
      <footer className="hidden md:flex flex-col w-full border-t border-gray-200 dark:border-discord-card bg-white dark:bg-discord-main shrink-0 z-10 mt-auto transition-colors duration-300">
        <div className="max-w-350 w-full mx-auto px-8 py-10 grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
          {/* COLUMN 1: Brand & Description */}
          <div className="flex flex-col gap-3">
            <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight flex items-center gap-2">
              <div className="bg-green-500 dark:bg-neon-blue p-1.5 rounded-lg text-white">
                <Brush size={20} strokeWidth={2.5} />
              </div>
              Scribblitz.
            </h2>
            <p className="text-sm font-bold text-gray-500 dark:text-gray-400 max-w-sm">
              A real-time, highly concurrent multiplayer drawing engine built to make game nights
              chaotic and competitive.
            </p>
          </div>

          {/* COLUMN 2: Explore / Rules */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">
              Explore
            </h3>
            <button
              onClick={() => setIsRulesOpen(true)}
              className="flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-neon-blue transition-colors w-fit group cursor-pointer"
            >
              <ScrollText size={16} className="group-hover:scale-110 transition-transform" />
              How to Play
            </button>
          </div>

          {/* COLUMN 3: Powered By (React Bits LogoLoop) */}
          <div className="flex flex-col gap-3 overflow-hidden">
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">
              Powered By
            </h3>

            <div className="w-full flex items-center h-10 relative mask-edges overflow-hidden">
              <LogoLoop
                logos={techStack}
                speed={30}
                gap={48}
                logoHeight={24}
                pauseOnHover={true}
                //Injected overflow-hidden! to brutally enforce no scrolling on the loop itself
                className="opacity-70 hover:opacity-100 transition-opacity duration-300 overflow-hidden!"
              />
              <div className="absolute inset-y-0 left-0 w-12 bg-linear-to-r from-white dark:from-discord-main to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-12 bg-linear-to-l from-white dark:from-discord-main to-transparent z-10 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Copyright & Links */}
        <div className="w-full border-t border-gray-200 dark:border-discord-card py-4">
          <div className="max-w-350 w-full mx-auto px-8 flex justify-between items-center text-xs font-bold text-gray-400 dark:text-gray-500">
            <div className="flex gap-3">
              <span>
                <span className="hover:text-green-500 dark:hover:text-neon-blue transition-colors cursor-default">
                  &copy; {new Date().getFullYear()} Mirza Mohammad Abbas
                </span>
                .
              </span>
              <span className="hidden lg:inline">•</span>
              <span className="hidden lg:inline hover:text-green-500 dark:hover:text-neon-blue transition-colors cursor-default">
                MIT License
              </span>
              <span className="hidden lg:inline">•</span>
              <span className="hidden lg:inline hover:text-green-500 dark:hover:text-neon-blue transition-colors cursor-default">
                v1.0.0
              </span>
            </div>

            <div className="flex items-center gap-6">
              <a
                href="https://github.com/mirza-mohammad24/scribblitz"
                target="_blank"
                rel="noreferrer"
                className="hover:text-green-500 dark:hover:text-neon-blue transition-colors flex items-center gap-1.5"
              >
                <FaGithub size={14} /> Source Code
              </a>
              <a
                href="https://www.linkedin.com/in/mirza-mohammad-abbas/"
                target="_blank"
                rel="noreferrer"
                className="hover:text-green-500 dark:hover:text-neon-blue transition-colors flex items-center gap-1.5"
              >
                <FaLinkedin size={14} /> Developer
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Rules Modal */}
      <RulesModal isOpen={isRulesOpen} onClose={() => setIsRulesOpen(false)} />
    </>
  );
};
