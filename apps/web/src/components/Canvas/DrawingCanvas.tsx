/**
 * This component renders a canvas element that serves as the drawing area for the game. It uses the
 * useCanvasDrawing hook to handle all drawing logic, including pointer events and real-time synchronization
 * with other players via WebSockets. The canvas is styled to look like a piece of paper, and it supports both
 * mouse and touch input for a seamless drawing experience across devices. The component also ensures that
 * non-drawing players cannot interact with the canvas, maintaining the integrity of the game.
 */

'use client';

import { useRef, useEffect, useState } from 'react';
import { useCanvasDrawing, CANVAS_CONFIG } from '@/hooks/useCanvasDrawing';
import { useGameSocket } from '@/hooks/useGameSocket';
import { useGameStore } from '@/store/gameStore';

interface DrawingCanvasProps {
  isDrawer: boolean;
  roomCode: string;
}

export const DrawingCanvas = ({ isDrawer, roomCode }: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { socket } = useGameSocket();

  //Extract the roundId
  const roundId = useGameStore((state) => state.roundId);

  //Wireframe UI State
  const [color, setColor] = useState('#000000');
  const [size, setSize] = useState(5);
  const [tool, setTool] = useState<'draw' | 'erase' | 'fill'>('draw');

  // Retina / High-DPI Display Setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Get the pixel density of the current device (1 for standard, 2 or 3 for Retina/Mobile)
    const dpr = window.devicePixelRatio || 1;

    // Set actual memory size of the canvas to be scaled up by the device pixel ratio
    canvas.width = CANVAS_CONFIG.WIDTH * dpr;
    canvas.height = CANVAS_CONFIG.HEIGHT * dpr;

    // Tell the internal drawing context to scale itself automatically
    ctx.scale(dpr, dpr);

    //The warm-white paper: #FAFAF8
    //This color stays fixed regardless of the system's Dark/Light mode to solve the Paper vs Ink contrast problem.
    //The rest of the UI can adapt to the theme, but the canvas remains a consistent drawing surface.
    ctx.fillStyle = CANVAS_CONFIG.PAPER_COLOR;
    ctx.fillRect(0, 0, CANVAS_CONFIG.WIDTH, CANVAS_CONFIG.HEIGHT);
  }, []);

  const { handlePointerDown, handlePointerMove, handlePointerUp, executeClear, executeUndo } =
    useCanvasDrawing(canvasRef, isDrawer, roomCode, color, size, tool, socket);

  return (
    <div className="w-full flex flex-col items-center gap-4">
      {/* 🛠️ WIREFRAME CONTROLS (For logic testing only) */}
      {isDrawer && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-200 dark:bg-gray-800 rounded-lg w-full max-w-4xl font-mono text-sm">
          <div className="flex gap-2 border-r pr-4 border-gray-400">
            <button
              onClick={() => setTool('draw')}
              className={`px-2 py-1 ${tool === 'draw' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
            >
              ✏️ Draw
            </button>
            <button
              onClick={() => setTool('erase')}
              className={`px-2 py-1 ${tool === 'erase' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
            >
              🧼 Erase
            </button>
            <button
              onClick={() => setTool('fill')}
              className={`px-2 py-1 ${tool === 'fill' ? 'bg-blue-500 text-white' : 'bg-white text-black'}`}
            >
              🪣 Fill
            </button>
          </div>

          <div className="flex gap-1 border-r pr-4 border-gray-400">
            {['#000000', '#FF0000', '#00FF00', '#0000FF'].map((hex) => (
              <button
                key={hex}
                onClick={() => setColor(hex)}
                className={`w-6 h-6 border ${color === hex ? 'ring-2 ring-black' : ''}`}
                style={{ backgroundColor: hex }}
              />
            ))}
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
              className="w-8 h-8 ml-2 cursor-pointer"
              title="Custom Mixer"
            />
          </div>

          <div className="flex items-center gap-2 border-r pr-4 border-gray-400">
            <span>Size:</span>
            <input
              type="range"
              min="2"
              max="40"
              value={size}
              onChange={(e) => setSize(parseInt(e.target.value))}
            />
            <span>{size}px</span>
          </div>

          <div className="flex gap-2 ml-auto">
            <button onClick={executeUndo} className="px-3 py-1 bg-yellow-500 text-black font-bold">
              Undo
            </button>
            <button onClick={executeClear} className="px-3 py-1 bg-red-600 text-white font-bold">
              Clear All
            </button>
          </div>
        </div>
      )}

      {/* Actual Drawing Area */}
      <div className="relative w-full max-w-4xl aspect-4/3 border shadow-md bg-white touch-none">
        <canvas
          ref={canvasRef}
          className={`w-full h-full ${isDrawer ? (tool === 'fill' ? 'cursor-alias' : 'cursor-crosshair') : 'cursor-default'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
        />
      </div>
    </div>
  );
};
