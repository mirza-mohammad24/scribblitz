'use client';

/**
 * @file ArenaCanvas.tsx — Real-time collaborative drawing canvas with integrated toolbox.
 *
 * This component owns the `<canvas>` element and the full drawing toolbox UI
 * (pen, eraser, fill-bucket, brush sizes, color palette, undo, clear).
 *
 * Key responsibilities:
 * - **Retina / HiDPI support**: On mount, the canvas backing store is scaled
 *   by `window.devicePixelRatio` while CSS dimensions remain at logical size,
 *   ensuring crisp lines on high-density displays.
 * - **Tool state isolation**: Color, size, and active tool are local `useState`
 *   values — changes here never re-render the parent orchestrator.
 * - **Drawing delegation**: All pointer event handling and real-time socket
 *   synchronization are delegated to the {@link useCanvasDrawing} hook.
 * - **Security**: When `isDrawer` is false, an invisible overlay div covers
 *   the canvas to block all pointer interactions for guessers.
 *
 * @see {@link useCanvasDrawing} — hook providing pointer handlers and socket sync
 * @see {@link CANVAS_CONFIG} — shared canvas dimension constants
 */

import { useRef, useEffect, useState } from 'react';
import { useCanvasDrawing, CANVAS_CONFIG } from '@/hooks/useCanvasDrawing';
import { useGameSocket } from '@/hooks/useGameSocket';
import { Pencil, Eraser, PaintBucket, Undo2, Trash2, Palette } from 'lucide-react';
import { motion } from 'framer-motion';

interface ArenaCanvasProps {
  /** Whether the current user is the active drawer with permission to draw. */
  isDrawer: boolean;
  /** The room code used for socket event namespacing. */
  roomCode: string;
}

// 13 preset colors + a custom color mixer. Total 14 for 2 rows of 7 colors each.
// The custom mixer is always the last button.
const PRESET_COLORS = [
  '#000000',
  '#FFFFFF',
  '#9CA3AF',
  '#EF4444',
  '#F97316',
  '#F59E0B',
  '#84CC16',
  '#22C55E',
  '#06B6D4',
  '#3B82F6',
  '#6366F1',
  '#A855F7',
  '#EC4899',
];

const BRUSH_SIZES = [
  { value: 4, label: 'xs' },
  { value: 10, label: 'sm' },
  { value: 18, label: 'md' },
  { value: 28, label: 'lg' },
  { value: 40, label: 'xl' },
];

/**
 * Collaborative drawing canvas with an integrated drawing toolbox.
 *
 * Renders a Retina-aware `<canvas>` element paired with a multi-row toolbox
 * containing drawing tools, brush sizes, color presets, and action buttons.
 * Pointer events are forwarded to the {@link useCanvasDrawing} hook which
 * handles local rendering and real-time socket broadcast.
 *
 * @param props - {@link ArenaCanvasProps}
 * @param props.isDrawer - `true` if the current user is the assigned drawer
 *   with an active drawing phase (DRAWING state + assigned drawer ID match).
 * @param props.roomCode - The current room code for socket event scoping.
 * @returns The canvas element and, when `isDrawer` is true, the toolbox UI.
 */
export const ArenaCanvas = ({ isDrawer, roomCode }: ArenaCanvasProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { socket } = useGameSocket();

  // Localized Tool State (Keeps re-renders isolated to just this component!)
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

  // Custom hook to handle all drawing logic, including pointer events and real-time synchronization
  const { handlePointerDown, handlePointerMove, handlePointerUp, executeClear, executeUndo } =
    useCanvasDrawing(canvasRef, isDrawer, roomCode, color, size, tool, socket);

  return (
    <div className="w-full h-full flex flex-col gap-3 min-h-0">
      {/* CANVAS WRAPPER */}
      <div className="flex-1 w-full min-h-0 flex justify-center items-center bg-gray-100/50 dark:bg-discord-main/30 rounded-3xl relative overflow-hidden shrink-0">
        <canvas
          ref={canvasRef}
          className={`max-w-full max-h-full aspect-4/3 object-contain bg-[#FAFAF8] rounded-2xl shadow-md border-4 border-gray-200 dark:border-discord-main touch-none ${
            isDrawer ? (tool === 'fill' ? 'cursor-alias' : 'cursor-crosshair') : 'cursor-default'
          }`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onPointerLeave={handlePointerUp}
          style={{ touchAction: 'none' }}
        />
        {!isDrawer && <div className="absolute inset-0 z-10" />}
      </div>

      {/* MULTI-LINE TOOLBOX */}
      {isDrawer && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full bg-white dark:bg-discord-card border-4 border-gray-200 dark:border-discord-main p-2.5 md:p-3 rounded-3xl shadow-sm flex flex-col gap-3 shrink-0"
        >
          {/* TOP ROW: Tools | Size Buttons | Undo/Clear */}
          <div className="flex justify-start md:justify-between items-center gap-2 overflow-x-auto w-full pb-1 md:pb-0 hide-scrollbar">
            {/* Tools */}
            <div className="flex gap-1 bg-gray-100 dark:bg-discord-main p-1.5 rounded-xl border-2 border-gray-200 dark:border-gray-800">
              <button
                onClick={() => setTool('draw')}
                className={`p-2 rounded-lg transition-all ${tool === 'draw' ? 'bg-green-500 dark:bg-neon-blue text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                <Pencil size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setTool('fill')}
                className={`p-2 rounded-lg transition-all ${tool === 'fill' ? 'bg-green-500 dark:bg-neon-blue text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                <PaintBucket size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={() => setTool('erase')}
                className={`p-2 rounded-lg transition-all ${tool === 'erase' ? 'bg-green-500 dark:bg-neon-blue text-white shadow-md' : 'text-gray-500 hover:text-gray-900 dark:hover:text-gray-100'}`}
              >
                <Eraser size={18} strokeWidth={2.5} />
              </button>
            </div>

            <div className="flex-1 flex justify-center items-center gap-1 md:gap-2 px-2 bg-gray-100 dark:bg-discord-main p-1.5 rounded-xl border-2 border-gray-200 dark:border-gray-800">
              {BRUSH_SIZES.map((s) => (
                <button
                  key={s.label}
                  onClick={() => setSize(s.value)}
                  disabled={tool === 'fill'}
                  className={`flex items-center justify-center w-8 h-8 rounded-lg transition-colors disabled:opacity-30 ${
                    size === s.value && tool !== 'fill'
                      ? 'bg-green-200 dark:bg-neon-blue/20 shadow-inner'
                      : 'hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                  title={`Brush Size: ${s.label}`}
                >
                  <div
                    className={`${size === s.value && tool !== 'fill' ? 'bg-green-600 dark:bg-neon-blue' : 'bg-gray-700 dark:bg-gray-300'} rounded-full transition-all`}
                    style={{
                      width: Math.max(4, s.value / 1.5),
                      height: Math.max(4, s.value / 1.5),
                    }}
                  />
                </button>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-1.5">
              <button
                onClick={executeUndo}
                className="p-2.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600 dark:text-yellow-500 border-2 border-yellow-200 dark:border-yellow-700/50 rounded-xl hover:bg-yellow-200 active:scale-95 transition-all"
              >
                <Undo2 size={18} strokeWidth={2.5} />
              </button>
              <button
                onClick={executeClear}
                className="p-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-500 border-2 border-red-200 dark:border-red-700/50 rounded-xl hover:bg-red-200 active:scale-95 transition-all"
              >
                <Trash2 size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>

          {/* BOTTOM ROW: CSS Grid of 14 equal slots (7 per line) */}
          <div className="grid grid-cols-7 gap-2 md:gap-3 justify-items-center">
            {PRESET_COLORS.map((hex) => (
              <button
                key={hex}
                onClick={() => {
                  setColor(hex);
                  if (tool === 'erase') setTool('draw');
                }}
                className={`w-full max-w-9 md:max-w-10 aspect-square rounded-xl border-4 shadow-sm transition-transform active:scale-90 ${
                  color === hex && tool !== 'erase'
                    ? 'border-green-500 dark:border-neon-blue scale-110'
                    : 'border-gray-200 dark:border-gray-600 hover:scale-105'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}

            {/* Custom Color Mixer Slot */}
            <div className="relative w-full max-w-9 md:max-w-10 aspect-square rounded-xl overflow-hidden border-4 border-gray-200 dark:border-gray-600 hover:scale-105 transition-transform group">
              <div className="absolute inset-0 flex items-center justify-center bg-gray-100 dark:bg-discord-main pointer-events-none z-10 group-hover:opacity-0 transition-opacity">
                <Palette size={20} className="text-gray-500 dark:text-gray-400" />
              </div>
              <input
                type="color"
                value={color}
                onChange={(e) => {
                  setColor(e.target.value);
                  if (tool === 'erase') setTool('draw');
                }}
                className="absolute -top-2 -left-2 w-16 h-16 cursor-pointer"
              />
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
