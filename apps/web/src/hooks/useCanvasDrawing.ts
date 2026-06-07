/**
 * useCanvasDrawing Hook
 * This hook encapsulates all the logic related to drawing on the canvas, including handling pointer events,
 * managing the drawing buffer, and communicating with the server via WebSockets. It abstracts away the complexities
 * of canvas manipulation and real-time synchronization, providing a clean interface for the DrawingCanvas component.
 */

import React, { useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { StrokeEvent, ClientEvents, ServerEvents } from '@scribblitz/types';
import { GAME_CONSTANTS } from '../../../../packages/shared/dist';

// Centralize logical dimensions to prevent magic-number drift and ensure multiplayer sync
export const CANVAS_CONFIG = {
  WIDTH: 800,
  HEIGHT: 600,
  PAPER_COLOR: '#FAFAF8',
  MAX_BUFFER_SIZE: 1000,
};

/**
 * Utility function to convert pointer event coordinates to canvas coordinates, accounting for scaling and offsets.
 * This ensures that drawing remains accurate even if the canvas is resized or displayed on high-DPI screens.
 * @param e
 * @param canvas
 * @returns An object containing the x and y coordinates relative to the canvas
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

/**
 * useCanvasDrawing Hook
 * This hook encapsulates all the logic related to drawing on the canvas, including handling pointer events,
 * managing the drawing buffer, and communicating with the server via WebSockets. It abstracts away the complexities
 * of canvas manipulation and real-time synchronization, providing a clean interface for the DrawingCanvas component.
 * @param canvasRef
 * @param isDrawer
 * @param roomCode
 * @param currentColor
 * @param brushSize
 * @param socket
 * @returns An object containing pointer event handlers to be attached to the canvas element
 */
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
  const currentStrokeId = useRef<string>(''); //Tracks the current continuous line

  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
    }
  }, [canvasRef]);

  /**
   * Draws a stroke on the canvas at the specified coordinates. If isInitial is true, it means this is the
   * start of a new stroke (a dot), otherwise it's a continuation of an existing stroke (a line). The function
   * sets the appropriate brush settings and uses the Canvas API to render the stroke on the canvas.
   * @param x
   * @param y
   * @param isInitial
   */
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

  /**
   * Captures a stroke event and adds it to the buffer for later transmission. Each stroke
   * event includes the current and last coordinates, stroke ID, color, brush size, session ID,
   * timestamp, and round ID. The buffer is used to batch multiple stroke events together before
   * sending them to the server, which helps reduce network overhead and ensures smoother real-time
   * synchronization with other players.
   * @param x
   * @param y
   * @param lastX
   * @param lastY
   */
  const captureStroke = (x: number, y: number, lastX: number, lastY: number) => {
    //Backpressure Protection: Prevent infinite memory growth if connection lags
    if (buffer.current.length >= CANVAS_CONFIG.MAX_BUFFER_SIZE) {
      buffer.current.shift(); // Drop the oldest stroke to make room for new ones
    }

    buffer.current.push({
      type: 'draw',
      x,
      y,
      lastX,
      lastY,
      strokeId: currentStrokeId.current,
      color: currentColor,
      brushSize,
      sessionId: roomCode,
      timestamp: Date.now(),
      roundId: 0,
    });
  };

  /**
   * Handles the pointer down event on the canvas. When the user presses down on the canvas,
   * this function checks if they are the drawer and if the canvas reference is valid. It then
   * captures the pointer to ensure it receives all subsequent pointer events, generates a new
   * stroke ID for the new stroke, sets the drawing state to true, calculates the initial coordinates,
   * draws the initial dot, and captures the stroke event for synchronization with other players.
   * @param e
   */
  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !canvasRef.current) return;

    (e.target as HTMLElement).setPointerCapture(e.pointerId); //Own the pointer

    // GENERATE ID: Start a new Stroke ID every time the pen touches the paper
    currentStrokeId.current = crypto.randomUUID();

    isDrawing.current = true;
    const { x, y } = getCoordinates(e, canvasRef.current);
    drawStroke(x, y, true);
    lastPos.current = { x, y };

    // For the very first dot, current and last coordinates are the same
    captureStroke(x, y, x, y);
    lastPos.current = { x, y };
  };

  /**
   * Handles the pointer move event on the canvas. When the user moves the pointer while pressed down,
   * this function checks if they are the drawer and if the canvas reference is valid. It then calculates
   * the new coordinates, draws the stroke, and captures the stroke event for synchronization with other players.
   * The function also includes backpressure protection to prevent memory overflow if the user draws too quickly
   * or if the network connection is slow.
   * @param e
   */
  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawer || !isDrawing.current || !canvasRef.current || !lastPos.current) return;

    const { x, y } = getCoordinates(e, canvasRef.current);

    //Grab the previous coordinates BEFORE we update them
    const lx = lastPos.current.x;
    const ly = lastPos.current.y;

    drawStroke(x, y, false);

    //Pass the old and new coordinates to the buffer for more accurate stroke reconstruction on the watchers' side
    captureStroke(x, y, lx, ly);
    lastPos.current = { x, y }; //Update for the next curve
  };

  /**
   * Handles the pointer up event on the canvas. When the user releases the pointer,
   * this function checks if they are the drawer and if the canvas reference is valid.
   * It then sets the drawing state to false, resets the last position, and releases the pointer capture
   * to allow other elements to receive pointer events.
   * @param e
   */
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

  //Incoming Network Strokes (For Watchers)
  useEffect(() => {
    if (isDrawer || !socket) return; //Only watchers need to listen

    const handleIncomingBatch = (payload: { strokes: StrokeEvent[] }) => {
      payload.strokes.forEach((stroke) => {
        if (stroke.type === 'draw') {
          //Temporarily override brush settings to match the incoming stroke
          const ctx = ctxRef.current!;
          const tempColor = ctx.strokeStyle;
          const tempSize = ctx.lineWidth;

          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          //Start at lastX/lastY, draw to x/y
          ctx.beginPath();
          ctx.moveTo(stroke.lastX, stroke.lastY);
          ctx.lineTo(stroke.x, stroke.y);
          ctx.stroke();

          //Restore
          ctx.strokeStyle = tempColor;
          ctx.lineWidth = tempSize;
        }
      });
    };

    socket.on(ServerEvents.CANVAS_BATCH, handleIncomingBatch);

    return () => {
      socket.off(ServerEvents.CANVAS_BATCH, handleIncomingBatch);
    };
  }, [isDrawer, socket]);

  return { handlePointerDown, handlePointerMove, handlePointerUp };
};
