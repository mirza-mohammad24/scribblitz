import React, { useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { StrokeEvent, ClientEvents } from '@scribblitz/types';
import { GAME_CONSTANTS } from '../../../../packages/shared/dist';

// Centralize logical dimensions to prevent magic-number drift and ensure multiplayer sync
export const CANVAS_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  PAPER_COLOR: '#FAFAF8',
  MAX_BUFFER_SIZE: 1000,
};

/**
 *
 * @param e
 * @param canvas
 * @returns
 */
const getCoordinates = (e: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = CANVAS_CONFIG.WIDTH / rect.width;
  const scaleY = CANVAS_CONFIG.HEIGHT / rect.height;
  return {
    x: (e.clientX - rect.left) * scaleX,
    y: (e.clientY - rect.top) * scaleY,
  };
};

export const useCanvasDrawing = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isDrawer: boolean,
  roomCode: string,
  currentColor: string,
  brushSize: number,
  socket?: Socket | null,
) => {
  const buffer = useRef<StrokeEvent[]>([]);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
    }
  }, [canvasRef]);

  const drawStroke = (x: number, y: number, isInitial: boolean) => {
    const ctx = ctxRef.current;
    if (!ctx) return;

    ctx.strokeStyle = currentColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = 'round'; //Makes the ends of lines rounded for a more natural look
    ctx.lineJoin = 'round'; //Smooths the corners where lines meet, especially at higher brush sizes

    ctx.beginPath();

    if (isInitial || !lastPos.current) {
      ctx.moveTo(x, y);
      ctx.lineTo(x, y); // Just a dot for a single click
    } else {
      ctx.moveTo(lastPos.current.x, lastPos.current.y);
      ctx.lineTo(x, y);
    }

    ctx.stroke();
  };

  const captureStroke = (x: number, y: number) => {
    //Backpressure Protection: Prevent infinite memory growth if connection lags
    if (buffer.current.length >= CANVAS_CONFIG.MAX_BUFFER_SIZE) {
      buffer.current.shift(); // Drop the oldest stroke to make room for new ones
    }

    buffer.current.push({
      type: 'draw',
      x,
      y,
      color: currentColor,
      brushSize,
      sessionId: roomCode,
      timestamp: Date.now(),
      roundId: 0,
    });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !canvasRef.current) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId); //Own the pointer

    isDrawing.current = true;
    const { x, y } = getCoordinates(e, canvasRef.current);
    drawStroke(x, y, true);
    lastPos.current = { x, y };

    captureStroke(x, y);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawing.current || !canvasRef.current) return;

    const { x, y } = getCoordinates(e, canvasRef.current);
    drawStroke(x, y, false);
    lastPos.current = { x, y }; //Update for the next curve

    captureStroke(x, y);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer) return;
    isDrawing.current = false;
    lastPos.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId); //Release ownership
  };

  useEffect(() => {
    if (!isDrawer || !socket) return;

    const interval = setInterval(() => {
      if (buffer.current.length === 0) return;
      socket.emit(ClientEvents.CANVAS_BATCH, { strokes: buffer.current });
      buffer.current = [];
    }, GAME_CONSTANTS.CANVAS_BATCH_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [isDrawer, socket]);

  return { handlePointerDown, handlePointerMove, handlePointerUp };
};
