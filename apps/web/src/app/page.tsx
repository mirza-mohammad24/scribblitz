'use client';

import { DrawingCanvas } from '../components/Canvas/DrawingCanvas';
import { ThemeToggle } from '../components/ThemeToggle';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24 transition-colors duration-300">
      {/* Header Area */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div>
          {/* Using your new Fredoka font! */}
          <h1 className="font-scribble text-4xl text-blue-600 dark:text-blue-400">Scribblitz</h1>
          <p className="text-gray-600 dark:text-gray-400 font-sans mt-2">
            Canvas Engine Testing Ground
          </p>
        </div>
        <ThemeToggle />
      </div>

      {/* The Workspace */}
      <DrawingCanvas isDrawer={true} roomCode="TEST-123" />
    </main>
  );
}
