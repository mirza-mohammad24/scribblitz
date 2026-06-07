/**
 * This component renders a canvas element that serves as the drawing area for the game. It uses the
 * useCanvasDrawing hook to handle all drawing logic, including pointer events and real-time synchronization
 * with other players via WebSockets. The canvas is styled to look like a piece of paper, and it supports both
 * mouse and touch input for a seamless drawing experience across devices. The component also ensures that
 * non-drawing players cannot interact with the canvas, maintaining the integrity of the game.
 */

'use client';

import { useRef, useEffect } from 'react';
import { useCanvasDrawing, CANVAS_CONFIG } from '@/hooks/useCanvasDrawing';
import { useGameSocket } from '@/hooks/useGameSocket';

interface DrawingCanvasProps {
  isDrawer: boolean;
  roomCode: string;
  currentColor?: string;
  brushSize?: number;
}

export const DrawingCanvas = ({
  isDrawer,
  roomCode,
  currentColor = '#000000',
  brushSize = 5,
}: DrawingCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { socket } = useGameSocket();

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

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // Scale the drawing context to account for the higher pixel density

    //The warm-white paper: #FAFAF8
    //This color stays fixed regardless of the system's Dark/Light mode to solve the Paper vs Ink contrast problem.
    // The rest of the UI can adapt to the theme, but the canvas remains a consistent drawing surface.
    ctx.fillStyle = CANVAS_CONFIG.PAPER_COLOR;
    ctx.fillRect(0, 0, CANVAS_CONFIG.WIDTH, CANVAS_CONFIG.HEIGHT);
  }, []);

  const { handlePointerDown, handlePointerMove, handlePointerUp } = useCanvasDrawing(
    canvasRef,
    isDrawer,
    roomCode,
    currentColor,
    brushSize,
    socket,
  );

  return (
    // Workspace Layering: Dark background with breathing room
    <div className="w-full bg-neutral-900 p-6 md:p-10 rounded-xl flex items-center justify-center">
      {/* Floating Canvas Wrapper with Premium Shadows and Texture overlay */}
      <div className="relative w-full max-w-4xl aspect-4/3 rounded-3xl shadow-[0_20px_80px_rgba(0,0,0,0.45)] ring-1 ring-black/10 overflow-hidden touch-none">
        {/* The Actual Canvas */}
        <canvas
          ref={canvasRef}
          className={`w-full h-full bg-[${CANVAS_CONFIG.PAPER_COLOR}] ${isDrawer ? 'cursor-crosshair' : 'cursor-default'}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp} // Safety net for mobile interrupts
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
        />

        {/* Premium Paper Texture Overlay (pointer-events-none so it doesn't block drawing) */}
        <div
          className="absolute inset-0 pointer-events-none opacity-50"
          style={{
            backgroundImage: 'radial-gradient(rgba(0,0,0,0.035) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      </div>
    </div>
  );
};
