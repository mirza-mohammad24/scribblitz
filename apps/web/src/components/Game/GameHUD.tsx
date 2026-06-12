'use client';

import { useEffect, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { GameState } from '@scribblitz/types';

export const GameHUD = () => {
  const { gameState, currentRound, totalRounds, currentHint, config, currentDrawerId, players } =
    useGameStore();

  // We default the timer to whatever the room config is set to
  const startingTime = config?.drawTimeSeconds || 80;
  const [timeLeft, setTimeLeft] = useState(startingTime);

  // Find the username of the person currently drawing
  const drawer = players.find((p) => p.id === currentDrawerId);

  // ⏱️ Local Timer Logic
  useEffect(() => {
    // Only tick down if the game is actively in the drawing state
    if (gameState !== GameState.DRAWING) {
      // 🌟 FIX: Wrap the reset in a setTimeout to push it to the next tick.
      // This completely silences the "cascading render" warning!
      const resetTimeout = setTimeout(() => {
        setTimeLeft(startingTime);
      }, 0);

      return () => clearTimeout(resetTimeout);
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameState, startingTime]);

  return (
    <div className="w-full bg-white border-2 rounded-xl shadow-sm p-4 flex justify-between items-center">
      {/* Round Info */}
      <div className="flex flex-col text-center min-w-[80px]">
        <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">Round</span>
        <span className="text-2xl font-black text-blue-600">
          {currentRound} <span className="text-lg text-gray-400">/ {totalRounds}</span>
        </span>
      </div>

      {/* Word Hint & Drawer Status */}
      <div className="flex flex-col text-center flex-1 px-4">
        <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">
          {drawer ? `✏️ ${drawer.username} is drawing` : 'Waiting...'}
        </span>
        <span className="text-3xl sm:text-4xl font-mono font-bold tracking-[0.25em] text-black mt-1">
          {currentHint || '? ? ?'}
        </span>
      </div>

      {/* Timer */}
      <div className="flex flex-col text-center min-w-[80px]">
        <span className="text-sm text-gray-500 font-bold uppercase tracking-wider">Time</span>
        <span
          className={`text-3xl font-black ${timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}
        >
          {timeLeft}
        </span>
      </div>
    </div>
  );
};
