'use client';

/**
 * @module Footer
 * @description A desktop-only site footer displayed on the HomeScreen. Contains
 * brand information, modal triggers for "How to Play" and "Why Scribblitz?",
 * direct bug reporting links, and an animated tech stack marquee powered by
 * {@link LogoLoop}.
 *
 * Features keyboard accessibility (a11y) focus rings and a hidden developer
 * easter egg tied to the version number. Automatically hides when the user
 * is in the Lobby or Arena game states.
 */

import { useState } from 'react';
import { Brush, ScrollText, Bug, Zap, Terminal } from 'lucide-react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import {
  SiNextdotjs,
  SiReact,
  SiTypescript,
  SiNodedotjs,
  SiSocketdotio,
  SiTurborepo,
  SiPnpm,
  SiDocker,
  SiPrisma,
  SiTailwindcss,
  SiFramer,
  SiZod,
} from 'react-icons/si';
import { DiRedis } from 'react-icons/di';
import confetti from 'canvas-confetti';
import LogoLoop from '@/components/ReactBits/LogoLoop';
import { RulesModal } from '@/components/ui/RulesModal';
import { WhyScribblitzModal } from '@/components/ui/WhyScribblitzModal';
import { useGameStore } from '@/store/gameStore';
import { useToastStore } from '@/store/toastStore';

/**
 * Common accessibility classes for focus states.
 * Shows a custom brand-colored ring only when navigating via keyboard (Tab key).
 */
const focusClasses =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 dark:focus-visible:ring-neon-blue rounded-sm';

// Prop to bubble up the play trigger
interface FooterProps {
  onTriggerPlay?: () => void;
}
/**
 * Renders the site footer with brand info, explore links, a tech stack marquee,
 * copyright notice, and social links. Returns `null` when the game is active
 * (i.e., `gameState` is not `null`) to keep the UI focused on gameplay.
 * @param {FooterProps} props - The component props.
 * @returns {React.JSX.Element | null} The footer JSX or null if the game is active.
 */
export const Footer = ({ onTriggerPlay }: FooterProps) => {
  const gameState = useGameStore((state) => state.gameState);
  const addToast = useToastStore((state) => state.addToast);

  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isWhyOpen, setIsWhyOpen] = useState(false);

  // State to track clicks for the hidden easter egg
  const [eggCount, setEggCount] = useState(0);

  // Instantly hide the footer completely if the user is in the Lobby or Arena
  if (gameState !== null) {
    return null;
  }

  /**
   * Handles closing the modal and triggering the play action if necessary(play action received).
   * @param action
   */
  const handleModalClose = (action?: 'play') => {
    setIsRulesOpen(false);
    setIsWhyOpen(false);
    if (action === 'play' && onTriggerPlay) {
      // if the play action is received, trigger the play callback
      onTriggerPlay();
    }
  };

  /**
   * THE EASTER EGG LOGIC
   */
  const handleEasterEgg = () => {
    if (eggCount + 1 === 5) {
      const colors = ['#22c55e', '#00e5ff', '#FF3B30', '#FFFFFF'];

      const shoot = (particleRatio: number, opts: confetti.Options) => {
        confetti({
          origin: { x: 0, y: 0.8 },
          angle: 60,
          colors,
          zIndex: 9999,
          particleCount: Math.floor(200 * particleRatio),
          ...opts,
        });
        confetti({
          origin: { x: 1, y: 0.8 },
          angle: 120,
          colors,
          zIndex: 9999,
          particleCount: Math.floor(200 * particleRatio),
          ...opts,
        });
      };

      shoot(0.25, { spread: 26, startVelocity: 65, shapes: ['square'] });
      shoot(0.35, { spread: 60, startVelocity: 45 });
      shoot(0.2, { spread: 100, decay: 0.9, scalar: 0.8, shapes: ['circle'] });
      shoot(0.2, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.5 });

      addToast(
        <div className="flex items-center gap-2">
          <Terminal size={16} strokeWidth={2.5} />
          <span>SYSTEM OVERRIDE: Easter egg discovered.</span>
        </div>,
        'success',
      );

      setEggCount(0);
    } else {
      setEggCount(eggCount + 1);
    }
  };

  // Tech Stack with official brand colors
  // Tech Stack grouped logically: Frontend -> Language -> Backend -> DevOps
  const techStack = [
    // --- FRONTEND ---
    {
      node: (
        <a
          href="https://react.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#61DAFB] hover:scale-105 transition-transform"
        >
          <SiReact size={24} />
          <span className="font-black tracking-tight text-lg">React</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://nextjs.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-900 dark:text-white hover:scale-105 transition-transform"
        >
          <SiNextdotjs size={24} />
          <span className="font-black tracking-tight text-lg">Next.js</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://tailwindcss.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#38B2AC] hover:scale-105 transition-transform"
        >
          <SiTailwindcss size={24} />
          <span className="font-black tracking-tight text-lg">Tailwind CSS</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://www.framer.com/motion/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-900 dark:text-white hover:scale-105 transition-transform"
        >
          <SiFramer size={24} />
          <span className="font-black tracking-tight text-lg">Framer Motion</span>
        </a>
      ),
    },

    // --- SHARED / LANGUAGE ---
    {
      node: (
        <a
          href="https://www.typescriptlang.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#3178C6] hover:scale-105 transition-transform"
        >
          <SiTypescript size={24} />
          <span className="font-black tracking-tight text-lg">TypeScript</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://zod.dev/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#3E67B1] hover:scale-105 transition-transform"
        >
          <SiZod size={24} />
          <span className="font-black tracking-tight text-lg">Zod</span>
        </a>
      ),
    },

    // --- BACKEND ---
    {
      node: (
        <a
          href="https://nodejs.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#339933] hover:scale-105 transition-transform"
        >
          <SiNodedotjs size={24} />
          <span className="font-black tracking-tight text-lg">Node.js</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://socket.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-900 dark:text-white hover:scale-105 transition-transform"
        >
          <SiSocketdotio size={24} />
          <span className="font-black tracking-tight text-lg">Socket.IO</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://www.prisma.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-gray-900 dark:text-white hover:scale-105 transition-transform"
        >
          <SiPrisma size={24} />
          <span className="font-black tracking-tight text-lg">Prisma</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://redis.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#DC382D] hover:scale-105 transition-transform"
        >
          <DiRedis size={28} className="-ml-1" />
          <span className="font-black tracking-tight text-lg">Redis</span>
        </a>
      ),
    },

    // --- DEVOPS / TOOLING ---
    {
      node: (
        <a
          href="https://www.docker.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#2496ED] hover:scale-105 transition-transform"
        >
          <SiDocker size={24} />
          <span className="font-black tracking-tight text-lg">Docker</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://turbo.build/repo"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#EF4444] hover:scale-105 transition-transform"
        >
          <SiTurborepo size={24} />
          <span className="font-black tracking-tight text-lg">Turborepo</span>
        </a>
      ),
    },
    {
      node: (
        <a
          href="https://pnpm.io/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[#F69220] hover:scale-105 transition-transform"
        >
          <SiPnpm size={24} />
          <span className="font-black tracking-tight text-lg">pnpm</span>
        </a>
      ),
    },
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

          {/* COLUMN 2: Explore & Modals */}
          <div className="flex flex-col gap-3">
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">
              Explore
            </h3>

            <button
              onClick={() => setIsWhyOpen(true)}
              className={`flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-neon-blue transition-colors w-fit group cursor-pointer ${focusClasses}`}
            >
              <Zap size={16} className="group-hover:scale-110 transition-transform" />
              Why Scribblitz?
            </button>

            <button
              onClick={() => setIsRulesOpen(true)}
              className={`flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-neon-blue transition-colors w-fit group cursor-pointer ${focusClasses}`}
            >
              <ScrollText size={16} className="group-hover:scale-110 transition-transform" />
              How to Play
            </button>

            <a
              href="https://github.com/mirza-mohammad24/scribblitz/issues/new"
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-2 text-sm font-bold text-gray-500 dark:text-gray-400 hover:text-[#FF3B30] transition-colors w-fit group cursor-pointer ${focusClasses}`}
            >
              <Bug size={16} className="group-hover:scale-110 transition-transform" />
              Report a Bug
            </a>
          </div>

          {/* COLUMN 3: Powered By (React Bits LogoLoop) */}
          <div className="flex flex-col gap-3 overflow-hidden">
            <h3 className="text-sm font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">
              Powered By
            </h3>

            <div className="w-full flex items-center h-10 relative mask-edges overflow-hidden">
              <LogoLoop
                logos={techStack}
                speed={35}
                gap={48}
                logoHeight={32}
                pauseOnHover={true}
                className="opacity-70 hover:opacity-100 transition-opacity duration-300 overflow-hidden!"
              />
              <div className="absolute inset-y-0 left-0 w-12 bg-linear-to-r from-white dark:from-discord-main to-transparent z-10 pointer-events-none" />
              <div className="absolute inset-y-0 right-0 w-12 bg-linear-to-l from-white dark:from-discord-main to-transparent z-10 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* BOTTOM ROW: Copyright, Links, & Easter Egg */}
        <div className="w-full border-t border-gray-200 dark:border-discord-card py-4">
          <div className="max-w-350 w-full mx-auto px-8 flex justify-between items-center text-xs font-bold text-gray-400 dark:text-gray-500">
            <div className="flex gap-3 items-center">
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

              {/* THE HIDDEN EASTER EGG BUTTON */}
              <button
                onClick={handleEasterEgg}
                className={`hidden lg:inline hover:text-green-500 dark:hover:text-neon-blue transition-colors cursor-pointer select-none ${focusClasses}`}
                aria-label="App version"
              >
                v2.0.0
              </button>
            </div>

            <div className="flex items-center gap-6">
              <a
                href="https://github.com/mirza-mohammad24/scribblitz"
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:text-green-500 dark:hover:text-neon-blue transition-colors flex items-center gap-1.5 ${focusClasses}`}
              >
                <FaGithub size={14} /> Source Code
              </a>
              <a
                href="https://www.linkedin.com/in/mirza-mohammad-abbas/"
                target="_blank"
                rel="noopener noreferrer"
                className={`hover:text-green-500 dark:hover:text-neon-blue transition-colors flex items-center gap-1.5 ${focusClasses}`}
              >
                <FaLinkedin size={14} /> Developer
              </a>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Footer Modals */}
      <RulesModal isOpen={isRulesOpen} onClose={handleModalClose} />
      <WhyScribblitzModal isOpen={isWhyOpen} onClose={handleModalClose} />
    </>
  );
};
