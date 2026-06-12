/**
 * useCanvasDrawing Hook
 * This hook encapsulates all the logic related to drawing on the canvas, including handling pointer events,
 * managing the drawing buffer, and communicating with the server via WebSockets. It abstracts away the complexities
 * of canvas manipulation and real-time synchronization, providing a clean interface for the DrawingCanvas component.
 */

import React, { useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { StrokeEvent, ClientEvents, ServerEvents } from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { applyFloodFill } from '@/utils/floodFill';

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
  return {
    x: (e.clientX - rect.left) * (CANVAS_CONFIG.WIDTH / rect.width),
    y: (e.clientY - rect.top) * (CANVAS_CONFIG.HEIGHT / rect.height),
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
 * @param activeTool
 * @param socket
 * @returns An object containing pointer event handlers to be attached to the canvas element
 */
export const useCanvasDrawing = (
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  isDrawer: boolean,
  roomCode: string,
  roundId: number,
  currentColor: string,
  brushSize: number,
  activeTool: 'draw' | 'erase' | 'fill',
  socket?: Socket | null,
) => {
  const buffer = useRef<StrokeEvent[]>([]);
  const localHistory = useRef<StrokeEvent[]>([]);
  const isDrawing = useRef(false);
  const lastPos = useRef<{ x: number; y: number } | null>(null);
  const currentStrokeId = useRef<string>(''); //Tracks the current continuous line
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  useEffect(() => {
    if (canvasRef.current) {
      ctxRef.current = canvasRef.current.getContext('2d');
    }
  }, [canvasRef]);

  useEffect(() => {
    if (!socket || !roomCode || !canvasRef.current) return;

    //As soon as the canvas exists, ask the server for the past drawing history
    socket.emit(ClientEvents.CANVAS_SYNC_REQUEST, { roomCode });
  }, [socket, roomCode]);

  const captureStroke = (
    type: 'draw' | 'fill',
    x: number,
    y: number,
    lastX: number,
    lastY: number,
  ) => {
    const event: StrokeEvent = {
      type: type === 'draw' && activeTool === 'erase' ? 'erase' : type,
      x,
      y,
      lastX,
      lastY,
      strokeId: currentStrokeId.current,
      color: activeTool === 'erase' ? CANVAS_CONFIG.PAPER_COLOR : currentColor,
      brushSize,
      sessionId: roomCode,
      timestamp: Date.now(),
      roundId: roundId,
    };
    buffer.current.push(event);
    localHistory.current.push(event);
  };

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

    ctx.strokeStyle = activeTool === 'erase' ? CANVAS_CONFIG.PAPER_COLOR : currentColor;
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

  const redrawFromHistory = () => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    ctx.fillStyle = CANVAS_CONFIG.PAPER_COLOR;
    ctx.fillRect(0, 0, CANVAS_CONFIG.WIDTH, CANVAS_CONFIG.HEIGHT);

    localHistory.current.forEach((stroke) => {
      if (stroke.type === 'draw' || stroke.type === 'erase') {
        ctx.strokeStyle = stroke.type === 'erase' ? CANVAS_CONFIG.PAPER_COLOR : stroke.color;
        ctx.lineWidth = stroke.brushSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        ctx.moveTo(stroke.lastX, stroke.lastY);
        ctx.lineTo(stroke.x, stroke.y);
        ctx.stroke();
      } else if (stroke.type === 'fill') {
        const dpr = window.devicePixelRatio || 1;
        applyFloodFill(ctx, stroke.x * dpr, stroke.y * dpr, stroke.color);
      }
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

    const { x, y } = getCoordinates(e, canvasRef.current);

    if (activeTool === 'fill') {
      const ctx = ctxRef.current;
      const dpr = window.devicePixelRatio || 1;
      if (ctx) applyFloodFill(ctx, Math.floor(x * dpr), Math.floor(y * dpr), currentColor);
      captureStroke('fill', x, y, x, y); //For fills, lastX and lastY are irrelevant since it's not a line
      return;
    }

    isDrawing.current = true;
    drawStroke(x, y, true);
    lastPos.current = { x, y };

    captureStroke('draw', x, y, x, y); //For the initial point, lastX and lastY are the same as x and y
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
    if (
      !isDrawer ||
      !isDrawing.current ||
      !canvasRef.current ||
      !lastPos.current ||
      activeTool === 'fill'
    )
      return;

    const { x, y } = getCoordinates(e, canvasRef.current);
    const lastX = lastPos.current.x;
    const lastY = lastPos.current.y;

    drawStroke(x, y, false);
    captureStroke('draw', x, y, lastX, lastY);

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

  //Incoming Network Strokes (For Watchers and not drawer)
  useEffect(() => {
    if (!socket) return;

    const handleIncomingBatch = (payload: { strokes: StrokeEvent[] }) => {
      const ctx = ctxRef.current;
      if (!ctx || isDrawer) return;
      const dpr = window.devicePixelRatio || 1;

      payload.strokes.forEach((stroke) => {
        localHistory.current.push(stroke);
        if (stroke.type === 'draw' || stroke.type === 'erase') {
          ctx.strokeStyle = stroke.type === 'erase' ? CANVAS_CONFIG.PAPER_COLOR : stroke.color;
          ctx.lineWidth = stroke.brushSize;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';

          ctx.beginPath();
          ctx.moveTo(stroke.lastX, stroke.lastY);
          ctx.lineTo(stroke.x, stroke.y);
          ctx.stroke();
        } else if (stroke.type === 'fill') {
          applyFloodFill(ctx, Math.floor(stroke.x * dpr), Math.floor(stroke.y * dpr), stroke.color);
        }
      });
    };

    const handleServerClear = () => {
      localHistory.current = [];
      redrawFromHistory();
    };
    const handleServerUndo = (payload: { strokeId: string }) => {
      localHistory.current = localHistory.current.filter((s) => s.strokeId !== payload.strokeId);
      redrawFromHistory();
    };
    const handleHistorySync = (payload: { strokes: StrokeEvent[] }) => {
      localHistory.current = payload.strokes;
      redrawFromHistory();
    };

    socket.on(ServerEvents.CANVAS_BATCH, handleIncomingBatch);
    socket.on(ServerEvents.CANVAS_CLEARED, handleServerClear);
    //Automatically wipe the canvas clean when a new round starts and ends
    socket.on(ServerEvents.ROUND_STARTING, handleServerClear);
    socket.on(ServerEvents.ROUND_END, handleServerClear);
    socket.on(ServerEvents.CANVAS_UNDONE, handleServerUndo);
    socket.on(ServerEvents.CANVAS_HISTORY, handleHistorySync);

    return () => {
      socket.off(ServerEvents.CANVAS_BATCH, handleIncomingBatch);
      socket.off(ServerEvents.CANVAS_CLEARED, handleServerClear);
      socket.off(ServerEvents.ROUND_STARTING, handleServerClear);
      socket.off(ServerEvents.ROUND_END, handleServerClear);
      socket.off(ServerEvents.CANVAS_UNDONE, handleServerUndo);
      socket.off(ServerEvents.CANVAS_HISTORY, handleHistorySync);
    };
  }, [socket, isDrawer]);

  //Clear local history when a player changes roles (Drawer <-> Watcher) to prevent desync issues.
  useEffect(() => {
    localHistory.current = [];
    redrawFromHistory();
  }, [isDrawer]);

  const executeClear = () => {
    if (!isDrawer || !socket) return;
    localHistory.current = [];
    buffer.current = [];
    redrawFromHistory();
    socket.emit(ClientEvents.CANVAS_CLEAR);
  };

  const executeUndo = () => {
    if (!isDrawer || !socket) return;
    socket.emit(ClientEvents.CANVAS_UNDO);
  };

  return { handlePointerDown, handlePointerMove, handlePointerUp, executeClear, executeUndo };
};
