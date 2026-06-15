/**
 * This component renders a canvas element that serves as the drawing area for the game. It uses the
 * useCanvasDrawing hook to handle all drawing logic, including pointer events and real-time synchronization
 * with other players via WebSockets. The canvas is styled to look like a piece of paper, and it supports both
 * mouse and touch input for a seamless drawing experience across devices. The component also ensures that
 * non-drawing players cannot interact with the canvas, maintaining the integrity of the game.
 */

'use client';

import { useState, useEffect } from 'react';
import { DrawingCanvas } from '@/components/Canvas/DrawingCanvas';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ChatBox } from '@/components/Chat/ChatBox';
import { GameHUD } from '@/components/Game/GameHUD';
import { SplashScreen } from '@/components/Splash/SplashScreen';
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GameOverModal } from '@/components/ui/GameOverModal';
import { ToastManager } from '@/components/ui/ToastManager';
import { useGameStore } from '@/store/gameStore';
import { useToastStore } from '@/store/toastStore';
import { useGameSocket, ACTIVE_ROOM_KEY } from '@/hooks/useGameSocket';
import {
  ClientEvents,
  ServerEvents,
  GameState,
  RoomConfig,
  GameError,
  ErrorCode,
} from '@scribblitz/types';
import { LobbyScreen } from '@/components/Lobby/LobbyScreen';

export default function Home() {
  const { socket, isConnected, userId } = useGameSocket();
  const {
    gameState,
    roomCode,
    players,
    config,
    hostId,
    currentDrawerId,
    wordChoices,
    standings,
    setRoomState,
    resetGame, //Needed for leaving the room
  } = useGameStore();

  const addToast = useToastStore((state) => state.addToast);

  // State for the mobile player list toggle
  const [showPlayersMobile, setShowPlayersMobile] = useState(false);

  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  // ==========================================
  // SOCKET LISTENERS
  // ==========================================
  useEffect(() => {
    if (!socket) return;

    socket.on(ServerEvents.ROOM_CREATED, ({ room }) => {
      localStorage.setItem(ACTIVE_ROOM_KEY, room.code || room.roomCode); // Save active room code to localStorage for smart reconnection
      setRoomState(room);
    });

    socket.on(ServerEvents.ROOM_JOINED, ({ room }) => {
      localStorage.setItem(ACTIVE_ROOM_KEY, room.code || room.roomCode); // Save active room code to localStorage for smart reconnection
      setRoomState(room);
    });

    socket.on(ServerEvents.LOBBY_RESET, ({ room }) => {
      resetGame();
      setRoomState(room);
    });

    socket.on(ServerEvents.PLAYER_JOINED, ({ player }) => {
      const existing = useGameStore.getState().players;
      const filtered = existing.filter((p) => p.id !== player.id);
      setRoomState({ players: [...filtered, player] });
    });

    socket.on(ServerEvents.PLAYER_LEFT, ({ playerId }) =>
      setRoomState({ players: useGameStore.getState().players.filter((p) => p.id !== playerId) }),
    );

    //  Handle disconnections and host migrations
    socket.on(ServerEvents.PLAYER_DISCONNECTED, ({ playerId }) => {
      const updatedPlayers = useGameStore
        .getState()
        .players.map((p) => (p.id === playerId ? { ...p, isConnected: false } : p));
      setRoomState({ players: updatedPlayers });
    });

    socket.on(ServerEvents.HOST_CHANGED, ({ newHostId }) => {
      setRoomState({ hostId: newHostId });
    });

    socket.on(ServerEvents.ROOM_CONFIG_UPDATED, ({ config }) => setRoomState({ config }));

    socket.on(ServerEvents.GAME_STATE_CHANGED, ({ state }) => setRoomState({ gameState: state }));

    // ==========================================
    // ROUND MANAGER FLOW
    // ==========================================
    socket.on(ServerEvents.ROUND_STARTING, ({ drawerId, round, totalRounds, roundId }) => {
      setRoomState({
        currentDrawerId: drawerId,
        currentRound: round,
        totalRounds,
        roundId,
        gameState: GameState.ROUND_STARTING,
      });
    });

    socket.on(ServerEvents.WORD_CHOICES, ({ words }) => {
      setRoomState({ wordChoices: words });
    });

    socket.on(ServerEvents.ROUND_STARTED, ({ drawerId, wordLength, wordHint }) => {
      setRoomState({
        currentDrawerId: drawerId,
        wordLength,
        currentHint: wordHint,
        gameState: GameState.DRAWING,
        wordChoices: [],
      });
    });

    socket.on(
      ServerEvents.ROUND_END,
      ({
        correctWord,
        reason,
        scores,
      }: {
        correctWord: string;
        reason: string;
        scores: Array<{ id: string; username: string; score: number }>;
      }) => {
        const updatedPlayers = useGameStore.getState().players.map((p) => {
          const updated = scores.find((s) => s.id === p.id);
          return updated ? { ...p, score: updated.score } : p;
        });
        setRoomState({
          gameState: GameState.ROUND_END,
          correctWord,
          roundEndReason: reason,
          scores,
          players: updatedPlayers,
        });
      },
    );

    socket.on(ServerEvents.GAME_END, ({ standings }) => {
      setRoomState({ gameState: GameState.GAME_END, standings });
    });

    // ==========================================
    // CHAT & GAMEPLAY LISTENERS
    // ==========================================
    socket.on(ServerEvents.WORD_HINT_UPDATED, ({ hint }) => {
      setRoomState({ currentHint: hint });
    });

    socket.on(ServerEvents.CHAT_BROADCAST, (msg) => {
      const currentMessages = useGameStore.getState().chatMessages || [];
      setRoomState({ chatMessages: [...currentMessages, msg] });
    });

    socket.on(ServerEvents.PLAYER_GUESSED, ({ playerId, username }) => {
      // Update the UI to show this player guessed correctly (turn their name green)
      const updatedPlayers = useGameStore
        .getState()
        .players.map((p) => (p.id === playerId ? { ...p, hasGuessedCorrectly: true } : p));

      // Create the system message for the chat box
      const systemMessage = {
        senderId: 'system',
        senderName: 'System',
        message: `${username} guessed the word!`,
        isSystem: true,
      };

      const currentMessages = useGameStore.getState().chatMessages || [];

      //Update both the player list and the chat simultaneously
      setRoomState({
        players: updatedPlayers,
        chatMessages: [...currentMessages, systemMessage],
      });
    });

    socket.on(ServerEvents.GUESS_CORRECT, ({ pointsEarned }) => {
      addToast(`Correct! You earned +${pointsEarned} points!`, 'success');
    });

    // Deterministic Error Handling with standardized payload from the server
    socket.on(ServerEvents.ERROR, (error: GameError) => {
      // Fallback just in case a raw string slips through during transition
      const isFatal = error?.isFatal ?? false;
      const message = error?.message || JSON.stringify(error);

      if (isFatal) {
        // Backend explicitly commanded a disconnect (e.g., ROOM_FULL, ROOM_NOT_FOUND)
        localStorage.removeItem(ACTIVE_ROOM_KEY); // Clear active room from localStorage on fatal error to
        //  prevent reconnection loops
        resetGame();

        // Only show a scary red error toast if it was an active user failure
        if (error.code !== ErrorCode.SESSION_EXPIRED) {
          addToast(message, 'error');
        }
      } else {
        // Just a standard notice (e.g., UNAUTHORIZED for clicking start as a non-host)
        addToast(message, 'info');
      }
    });

    // CLEANUP
    return () => {
      socket.off(ServerEvents.ROOM_CREATED);
      socket.off(ServerEvents.ROOM_JOINED);
      socket.off(ServerEvents.LOBBY_RESET);
      socket.off(ServerEvents.PLAYER_JOINED);
      socket.off(ServerEvents.PLAYER_LEFT);
      socket.off(ServerEvents.PLAYER_DISCONNECTED);
      socket.off(ServerEvents.HOST_CHANGED);
      socket.off(ServerEvents.ROOM_CONFIG_UPDATED);
      socket.off(ServerEvents.GAME_STATE_CHANGED);
      socket.off(ServerEvents.ROUND_STARTING);
      socket.off(ServerEvents.WORD_CHOICES);
      socket.off(ServerEvents.ROUND_STARTED);
      socket.off(ServerEvents.ROUND_END);
      socket.off(ServerEvents.GAME_END);
      socket.off(ServerEvents.WORD_HINT_UPDATED);
      socket.off(ServerEvents.CHAT_BROADCAST);
      socket.off(ServerEvents.PLAYER_GUESSED);
      socket.off(ServerEvents.GUESS_CORRECT);
      socket.off(ServerEvents.ERROR);
    };
  }, [socket, setRoomState, resetGame]);

  // ==========================================
  // ACTIONS
  // ==========================================

  const handleStartGame = () => socket?.emit(ClientEvents.GAME_START, {});

  const updateConfig = (newConfig: Partial<RoomConfig>) =>
    socket?.emit(ClientEvents.ROOM_UPDATE_CONFIG, newConfig);

  const handleWordSelect = (word: string) => socket?.emit(ClientEvents.WORD_SELECT, { word });

  const handleLeaveRoom = () => {
    socket?.emit(ClientEvents.ROOM_LEAVE);
    localStorage.removeItem(ACTIVE_ROOM_KEY); // Clear active room from localStorage on leave
    resetGame();
  };

  const requestLeaveRoom = () => {
    if (gameState !== null) {
      setIsLeaveModalOpen(true);
    }
  };

  const handleReturnToLobby = () => {
    socket?.emit(ClientEvents.RETURN_TO_LOBBY);
  };

  // ==========================================
  // ROLE & SECURITY CHECKS
  // ==========================================
  const isHost = hostId === userId;
  const isAssignedDrawer = currentDrawerId === userId;
  // SECURE CANVAS LOCK: Only true if it is explicitly your turn AND the timer is actively ticking
  const canDraw = isAssignedDrawer && gameState === GameState.DRAWING;

  return (
    // Updated main wrapper to use dark:bg-discord-main
    <main className="flex h-dvh flex-col items-center p-4 lg:p-6 transition-colors duration-300 w-full max-w-6xl mx-auto min-h-0 bg-transparent dark:bg-discord-main">
      {/* Toast Notifications */}
      <ToastManager />

      {/* GLOBAL HEADER: Appears on Splash, Lobby, and Game Arena */}
      <div className="w-full flex justify-between items-center mb-4 z-10 shrink-0">
        <button
          onClick={requestLeaveRoom}
          className="text-3xl lg:text-4xl font-black text-green-600 dark:text-neon-blue tracking-tight drop-shadow-sm hover:text-red-600 dark:hover:text-neon-pink transition-colors text-left"
        >
          Scribblitz.
        </button>
        <ThemeToggle />
      </div>

      {/* ZONE 1: THE SPLASH SCREEN */}
      {gameState === null && (
        <SplashScreen
          onActionCreate={(username, avatarSeed) => {
            if (!socket?.connected) socket?.connect();
            socket?.emit(ClientEvents.ROOM_CREATE, {
              username,
              avatarSeed,
              config: { maxPlayer: 8, drawTimeSeconds: 80, roundCount: 3, mode: 'standard' },
            });
          }}
          onActionJoin={(username, roomCode, avatarSeed) => {
            if (!socket?.connected) socket?.connect();
            socket?.emit(ClientEvents.ROOM_JOIN, { username, roomCode, avatarSeed });
          }}
        />
      )}

      {/* ZONE 2: LOBBY */}
      {gameState === GameState.LOBBY && config && (
        <LobbyScreen
          roomCode={roomCode!}
          players={players}
          config={config}
          isHost={isHost}
          hostId={hostId!}
          onUpdateConfig={updateConfig}
          onStartGame={handleStartGame}
          onRequestLeave={requestLeaveRoom}
        />
      )}

      {/* ZONE 3: THE GAME ARENA */}
      {gameState !== null && gameState !== GameState.LOBBY && (
        <div className="w-full flex-1 flex flex-col items-center gap-4 min-h-0">
          <div className="w-full flex justify-between items-center shrink-0">
            {/* Mobile Player toggle */}
            <button
              onClick={() => setShowPlayersMobile(!showPlayersMobile)}
              className="lg:hidden bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 px-4 py-2 rounded-xl font-bold text-sm flex items-center gap-2 shadow-sm"
            >
              👥 Players ({players.length})
            </button>
            <button
              onClick={requestLeaveRoom}
              className="text-red-500 text-sm font-black border-2 border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 rounded-xl hover:bg-red-100 dark:hover:bg-red-900 transition-colors ml-auto"
            >
              Quit Game
            </button>
          </div>

          {/* Mobile Player Overlay */}
          {showPlayersMobile && (
            <div className="lg:hidden w-full bg-white dark:bg-gray-800 border-4 border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-lg shrink-0">
              <h3 className="font-black border-b-2 border-gray-100 dark:border-gray-700 pb-2 mb-2">
                Players
              </h3>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className={`px-3 py-1 rounded-full text-xs font-bold border-2 ${p.hasGuessedCorrectly ? 'bg-green-100 border-green-500 text-green-700' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600'}`}
                  >
                    {p.username} {p.id === currentDrawerId && '✏️'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* WORD SELECTION INTERFACE */}
          {gameState === GameState.ROUND_STARTING && (
            <div className="w-full max-w-4xl bg-yellow-100 dark:bg-yellow-900/30 border-4 border-yellow-400 dark:border-yellow-700 p-6 rounded-2xl text-center mb-2 shrink-0">
              {isAssignedDrawer ? (
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-2xl font-black text-yellow-900 dark:text-yellow-100">
                    Pick a Word!
                  </h2>
                  <div className="flex flex-wrap justify-center gap-4">
                    {wordChoices?.map((word) => (
                      <button
                        key={word}
                        onClick={() => handleWordSelect(word)}
                        className="bg-blue-500 hover:bg-blue-600 active:bg-blue-700 text-white px-6 py-3 rounded-xl font-black text-xl border-b-4 border-blue-700 active:border-b-0 active:translate-y-1 transition-all"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <h2 className="text-2xl font-black text-yellow-900 dark:text-yellow-100 animate-pulse">
                  Waiting for Drawer to pick...
                </h2>
              )}
            </div>
          )}

          {/* THE MOBILE-FIRST GAME GRID */}
          <div className="w-full flex-1 flex flex-col lg:flex-row gap-6 min-h-0">
            {/* Left Column: Canvas & Controls */}
            <div className="flex flex-col flex-2 gap-3 min-h-0 overflow-y-auto lg:overflow-visible pb-20 lg:pb-0">
              <GameHUD />
              <DrawingCanvas isDrawer={canDraw} roomCode={roomCode!} />
            </div>

            {/* Right Column: Chat Box */}
            <div className="w-full lg:w-87.5 shrink-0 flex justify-center h-[40vh] lg:h-full">
              <ChatBox />
            </div>
          </div>
        </div>
      )}

      <GameOverModal
        isOpen={gameState === GameState.GAME_END}
        standings={standings || []}
        isHost={isHost}
        onPlayAgain={handleReturnToLobby}
      />

      <ConfirmModal
        isOpen={isLeaveModalOpen}
        title="Abandon Game?"
        description="Are you sure you want to forfeit and leave the room? Your current score will be permanently lost and your player slot will be opened."
        confirmText="Yes, Forfeit"
        cancelText="Keep Playing"
        onConfirm={handleLeaveRoom}
        onCancel={() => setIsLeaveModalOpen(false)}
      />
    </main>
  );
}
