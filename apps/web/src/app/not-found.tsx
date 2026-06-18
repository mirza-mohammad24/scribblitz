import Link from 'next/link';
import { Home, Eraser } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex-1 w-full flex flex-col items-center justify-center p-4 min-h-0">
      <div className="w-full max-w-md bg-white dark:bg-discord-card border-4 border-gray-200 dark:border-discord-main rounded-[2rem] md:rounded-4xl p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,0.1)] dark:shadow-[8px_8px_0px_0px_rgba(0,0,0,0.3)] flex flex-col items-center text-center relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-red-100 dark:bg-neon-pink/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-green-100 dark:bg-neon-blue/10 rounded-full blur-3xl pointer-events-none" />

        {/* 404 Graphic */}
        <div className="relative flex items-center justify-center gap-2 mb-6 z-10">
          <span className="text-7xl md:text-8xl font-black text-gray-900 dark:text-gray-100 drop-shadow-sm">
            4
          </span>

          <div className="bg-red-500 dark:bg-neon-pink p-4 rounded-2xl md:rounded-3xl shadow-lg border-b-[6px] border-red-700 dark:border-pink-800 text-white transform -rotate-12 animate-pulse">
            <Eraser size={48} strokeWidth={2.5} className="md:w-16 md:h-16" />
          </div>

          <span className="text-7xl md:text-8xl font-black text-gray-900 dark:text-gray-100 drop-shadow-sm">
            4
          </span>
        </div>

        {/* Text Content */}
        <h2 className="text-3xl md:text-4xl font-black text-gray-800 dark:text-gray-100 mb-3 tracking-tight z-10">
          Page Erased!
        </h2>
        <p className="text-sm md:text-base font-bold text-gray-500 dark:text-gray-400 mb-8 max-w-[280px] md:max-w-xs z-10">
          Looks like someone rubbed this page out of existence, or the room code you entered is
          invalid.
        </p>

        {/* The Action Button */}
        <Link
          href="/"
          className="w-full z-10 flex items-center justify-center gap-2 bg-green-500 dark:bg-neon-blue hover:bg-green-600 dark:hover:bg-neon-blue-hover text-white py-3.5 md:py-4 rounded-xl md:rounded-2xl font-black text-lg md:text-xl border-b-[4px] border-green-700 dark:border-neon-blue-border active:border-b-0 active:translate-y-1 hover:scale-[1.02] active:scale-95 transition-all shadow-sm"
        >
          <Home size={24} strokeWidth={2.5} />
          Return to Lobby
        </Link>
      </div>
    </div>
  );
}
