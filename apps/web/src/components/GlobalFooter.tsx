'use client';

import { FileText, ScrollText, Code2, Zap } from 'lucide-react';
import { FaGithub, FaLinkedin } from 'react-icons/fa';
import { useGameStore } from '@/store/gameStore';

export const GlobalFooter = () => {
  const gameState = useGameStore((state) => state.gameState);

  if (gameState !== null) {
    return (
      <footer className="hidden md:flex w-full bg-white dark:bg-discord-main border-t-2 border-gray-200 dark:border-discord-card p-2 shrink-0 z-50 text-xs font-bold text-gray-400 flex justify-center items-center gap-4 transition-colors duration-300">
        <span>Scribblitz Engine</span>
        <span className="w-1 h-1 rounded-full bg-gray-300 dark:bg-discord-card"></span>
        <a
          href="https://github.com/yourusername/scribblitz"
          target="_blank"
          rel="noreferrer"
          className="hover:text-green-500 dark:hover:text-neon-blue transition-colors flex items-center gap-1"
        >
          <FaGithub size={12} /> Source
        </a>
      </footer>
    );
  }

  return (
    <footer className="hidden md:block w-full border-t-4 border-gray-200 dark:border-discord-card bg-white dark:bg-discord-main shrink-0 z-50 mt-auto transition-colors duration-300">
      <div className="max-w-6xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-black text-gray-800 dark:text-gray-100 tracking-tight">
            Scribblitz.
          </h2>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            A real-time, highly concurrent multiplayer drawing game. Gather your friends, create a
            room, and let the chaos begin.
          </p>
          <div className="flex items-center gap-2 text-sm font-black text-green-500 dark:text-neon-blue mt-2 hover:text-green-600 dark:hover:text-neon-pink cursor-pointer w-fit transition-colors">
            <ScrollText size={18} /> Read the Rules
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">
            Powered By
          </h3>
          <ul className="text-sm font-bold text-gray-500 dark:text-gray-400 flex flex-col gap-2">
            <li className="flex items-center gap-2">
              <Zap size={16} className="text-yellow-500" /> Next.js 15 & React 19
            </li>
            <li className="flex items-center gap-2">
              <Code2 size={16} className="text-blue-500" /> Socket.IO (Real-time Events)
            </li>
            <li className="flex items-center gap-2">
              <Code2 size={16} className="text-red-500" /> Redis (Time-Machine Sync)
            </li>
            <li className="flex items-center gap-2">
              <Code2 size={16} className="text-cyan-500" /> Tailwind CSS v4
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-black text-gray-800 dark:text-gray-100 uppercase tracking-widest">
            The Creator
          </h3>
          <p className="text-sm font-bold text-gray-500 dark:text-gray-400">
            Engineered from scratch. Check out the source code or connect with me below.
          </p>
          <div className="flex flex-wrap gap-3 mt-2">
            <a
              href="https://github.com/yourusername"
              target="_blank"
              rel="noreferrer"
              className="bg-green-50 dark:bg-discord-card p-3 rounded-xl border-2 border-green-200 dark:border-discord-main hover:border-green-400 dark:hover:border-neon-blue transition-colors text-green-600 dark:text-neon-blue"
            >
              <FaGithub size={20} />
            </a>
            <a
              href="https://linkedin.com/in/yourusername"
              target="_blank"
              rel="noreferrer"
              className="bg-green-50 dark:bg-discord-card p-3 rounded-xl border-2 border-green-200 dark:border-discord-main hover:border-green-400 dark:hover:border-neon-blue transition-colors text-green-600 dark:text-neon-blue"
            >
              <FaLinkedin size={20} />
            </a>
            <a
              href="/resume.pdf"
              target="_blank"
              rel="noreferrer"
              className="bg-green-50 dark:bg-discord-card p-3 rounded-xl border-2 border-green-200 dark:border-discord-main hover:border-green-400 dark:hover:border-neon-blue transition-colors text-green-600 dark:text-neon-blue"
              title="View ATS Resume"
            >
              <FileText size={20} />
            </a>
          </div>
        </div>
      </div>

      <div className="border-t-2 border-gray-100 dark:border-discord-card py-4 text-center text-xs font-bold text-gray-400">
        © {new Date().getFullYear()} Scribblitz Engine. All rights reserved.
      </div>
    </footer>
  );
};
