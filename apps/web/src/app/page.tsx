'use client';

import { ThemeToggle } from '@/components/ThemeToggle';
import { ToastManager } from '@/components/ui/ToastManager';
import { ArenaOrchestrator } from '@/components/Arena/ArenaOrchestrator';

export default function Home() {
  return (
    // The master wrapper. h-dvh ensures it fits mobile screens perfectly.
    <main className="flex h-dvh flex-col items-center p-2 lg:p-4 transition-colors duration-300 w-full max-w-400 mx-auto min-h-0 bg-transparent dark:bg-discord-main">
      <ToastManager />

      {/* GLOBAL HEADER: Appears on Splash, Lobby, and Game Arena */}
      <div className="w-full flex justify-between items-center mb-4 z-10 shrink-0">
        <h1 className="text-3xl lg:text-4xl font-black text-green-600 dark:text-neon-blue tracking-tight drop-shadow-sm cursor-default">
          Scribblitz
        </h1>
        <ThemeToggle />
      </div>

      {/* THE ENGINE: Delegates all game logic and UI rendering */}
      <ArenaOrchestrator />
    </main>
  );
}
