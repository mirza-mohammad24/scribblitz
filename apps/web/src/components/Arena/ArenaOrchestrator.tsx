'use client';

import { useState, useEffect } from 'react';
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
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { MessageCircle, X } from 'lucide-react';

// Screens
import { HomeScreen } from '@/components/Home/HomeScreen';
import { LobbyScreen } from '@/components/Lobby/LobbyScreen';

// Modals
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GameOverModal } from '@/components/ui/GameOverModal';

// Arena Components
import { ArenaHUD } from './ArenaHUD';
import { ArenaCanvas } from './ArenaCanvas';
import { ArenaChat } from './ArenaChat';
import { ArenaLeaderboard } from './ArenaLeaderboard';

export const ArenaOrchestrator = () => {
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

  // UI State
  // State for the mobile player list toggle
  const [showPlayersMobile, setShowPlayersMobile] = useState(false);
  // State for the leave confirmation modal
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);
  //State for the drawer's mobile chat peek overlay
  const [showChatMobile, setShowChatMobile] = useState(false);

  // ==========================================
  // SOCKET LISTENERS
  // ==========================================
  useEffect(() => {
    if (!socket) return;

    socket.on(ServerEvents.ROOM_CREATED, ({ room }) => {
      // Save active room code to localStorage for smart reconnection
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomCode);
      setRoomState(room);
    });

    socket.on(ServerEvents.ROOM_JOINED, ({ room }) => {
      // Save active room code to localStorage for smart reconnection
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomCode);
      // Reset chat messages on join to avoid showing stale messages from previous sessions
      setRoomState({ ...room, chatMessages: [] });
    });

    socket.on(ServerEvents.LOBBY_RESET, ({ room }) => {
      // Ensure the key is restored if the user refresh during the post-game lobby
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomCode);
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
      // Reset the "hasGuessedCorrectly" status for all players at the start of each round
      const resetPlayers = useGameStore.getState().players.map((p) => ({
        ...p,
        hasGuessedCorrectly: false,
      }));

      setRoomState({
        currentDrawerId: drawerId,
        currentRound: round,
        totalRounds,
        roundId,
        gameState: GameState.ROUND_STARTING,
        players: resetPlayers, // Reset guessing status at the start of each round
      });
    });

    socket.on(ServerEvents.WORD_CHOICES, ({ words }) => {
      setRoomState({ wordChoices: words });
    });

    socket.on(ServerEvents.ROUND_STARTED, ({ drawerId, wordLength, wordHint, roundStartTime }) => {
      setRoomState({
        currentDrawerId: drawerId,
        wordLength,
        currentHint: wordHint,
        roundStartTime,
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
      //We don't delete the active room key from localstorage here because the user may want to return to the
      // post-game lobby to play again
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
      //Fresh state snapshot from gameStore
      const currentState = useGameStore.getState();

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

      const currentMessages = currentState.chatMessages || [];

      // Only show toast if they are the drawer AND on a mobile-sized screen
      const isMobileScreen = typeof window !== 'undefined' && window.innerWidth < 768;
      if (currentState.currentDrawerId === userId && isMobileScreen) {
        addToast(`${username} guessed the word!`, 'success');
      }

      //Update both the player list and the chat simultaneously
      setRoomState({
        players: updatedPlayers,
        chatMessages: [...currentMessages, systemMessage],
      });
    });

    // Instantly updates the Zustand store with new scores whenever the server
    // broadcasts a score update (after a correct guess or at round end)
    socket.on(
      ServerEvents.SCORE_UPDATE,
      ({ scores }: { scores: Array<{ id: string; score: number }> }) => {
        const updatedPlayers = useGameStore.getState().players.map((p) => {
          const updated = scores.find((s) => s.id === p.id);
          return updated ? { ...p, score: updated.score } : p;
        });
        setRoomState({ players: updatedPlayers });
      },
    );

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
        // Clear active room from localStorage on fatal error to prevent reconnection loops
        localStorage.removeItem(ACTIVE_ROOM_KEY);
        // Purge the expectedRoom from Socket.io's internal memory
        // so it stops trying to auto-reconnect to a dead room
        if (socket) {
          socket.auth = { ...socket.auth, expectedRoom: undefined };
        }
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

    // Clean up listeners on unmount
    // Explicitly remove ONLY Arena listeners.
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
      socket.off(ServerEvents.SCORE_UPDATE);
      socket.off(ServerEvents.GUESS_CORRECT);
      socket.off(ServerEvents.ERROR);
    };
  }, [socket, setRoomState, resetGame, addToast]);

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
    <>
      {/* ZONE 1: THE HOME SCREEN */}
      {gameState === null && (
        <HomeScreen
          onActionCreate={(username, avatarSeed) => {
            if (!socket?.connected) socket?.connect();
            socket?.emit(ClientEvents.ROOM_CREATE, {
              username,
              avatarSeed,
              config: {
                maxPlayer: GAME_CONSTANTS.MAX_PLAYERS,
                drawTimeSeconds: GAME_CONSTANTS.DEFAULT_DRAW_TIME_SECONDS,
                roundCount: GAME_CONSTANTS.DEFAULT_ROUND_COUNT,
                mode: GAME_CONSTANTS.DEFAULT_ROUND_MODE,
              },
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
        <div className="w-full flex-1 flex flex-col gap-3 min-h-0 pb-2">
          {/* HUD spans all columns. Passes leave/mobile functions via props */}
          <ArenaHUD
            onRequestLeave={() => setIsLeaveModalOpen(true)}
            onToggleMobilePlayers={() => setShowPlayersMobile(!showPlayersMobile)}
          />

          {/* Mobile Players Popup (Hidden on Desktop) */}
          {showPlayersMobile && (
            <div className="lg:hidden w-full bg-white dark:bg-discord-card border-4 border-gray-200 dark:border-discord-main rounded-2xl p-4 shadow-lg shrink-0">
              <h3 className="font-black border-b-2 border-gray-100 dark:border-discord-main pb-2 mb-2">
                Players
              </h3>
              <div className="flex flex-wrap gap-2">
                {players.map((p) => (
                  <span
                    key={p.id}
                    className={`px-3 py-1 rounded-full text-xs font-bold border-2 transition-all 
                      ${
                        !p.isConnected
                          ? // The Offline State (Dims them out entirely)
                            'opacity-40 border-dashed bg-gray-200 dark:bg-gray-800 text-gray-500'
                          : p.hasGuessedCorrectly
                            ? // The Online + Guessed State
                              'bg-green-100 border-green-500 text-green-700'
                            : // The Online + Still Guessing State
                              'bg-gray-100 dark:bg-discord-main border-gray-300 dark:border-gray-600'
                      }`}
                  >
                    {p.username} {!p.isConnected && ' (Offline)'} {p.id === currentDrawerId && '✏️'}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* THE DESKTOP 3-COLUMN / MOBILE STACK GRID */}
          <div className="w-full h-full flex flex-col lg:flex-row gap-3 md:gap-4 min-h-0 overflow-hidden justify-center">
            {/* LEFT COLUMN: LEADERBOARD */}
            <div className="hidden lg:flex w-[240px] xl:w-[280px] shrink-0 min-h-0 flex-col">
              <ArenaLeaderboard />
            </div>

            {/* CENTER COLUMN: CANVAS & TOOLBOX */}
            <div className="flex-1 flex flex-col gap-3 min-h-0 relative w-full lg:max-w-[1100px] mx-auto">
              {/*  Mobile Peek Chat Button strictly for the Drawer */}
              {canDraw && (
                <div className="lg:hidden flex justify-end w-full shrink-0 -mb-2 z-10 relative px-2">
                  <button
                    onClick={() => setShowChatMobile(true)}
                    className="bg-white dark:bg-discord-card border-2 border-green-500 dark:border-neon-blue text-green-600 dark:text-neon-blue px-4 py-1.5 rounded-full text-xs font-black shadow-md hover:bg-green-50 dark:hover:bg-blue-900/30 active:scale-95 transition-all flex items-center gap-2"
                  >
                    <MessageCircle size={20} strokeWidth={2.5} />
                  </button>
                </div>
              )}

              {/* WORD SELECTION OVERLAY */}
              {gameState === GameState.ROUND_STARTING && (
                <div className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm rounded-3xl">
                  <div className="bg-white dark:bg-discord-card border-4 border-yellow-400 p-6 md:p-8 rounded-2xl text-center shadow-xl w-full max-w-md flex flex-col gap-6">
                    {isAssignedDrawer ? (
                      <>
                        <h2 className="text-2xl font-black">Pick a Word!</h2>
                        <div className="flex flex-col gap-3">
                          {wordChoices?.map((word) => (
                            <button
                              key={word}
                              onClick={() => handleWordSelect(word)}
                              className="bg-green-500 dark:bg-neon-blue text-white px-4 py-3 rounded-xl font-black border-b-[4px] border-green-700 dark:border-blue-900 hover:bg-green-600 dark:hover:bg-blue-600 active:border-b-0 active:translate-y-1 transition-all"
                            >
                              {word}
                            </button>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="flex flex-col items-center gap-4">
                        <div className="w-10 h-10 border-4 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                        <h2 className="text-xl font-black text-gray-800 dark:text-gray-200">
                          Waiting for Drawer...
                        </h2>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* CANVAS COMPONENT */}
              <ArenaCanvas isDrawer={canDraw} roomCode={roomCode!} />
            </div>

            {/* RIGHT COLUMN: CHATBOX */}
            {/* Transforms into a full-screen blurred backdrop modal on mobile for the drawer */}
            <div
              className={`
                w-full lg:w-70 xl:w-[320px] flex-col shrink-0 min-h-0
                ${
                  canDraw
                    ? showChatMobile
                      ? 'fixed inset-0 z-50 p-4 bg-black/60 dark:bg-black/80 backdrop-blur-md flex flex-col justify-center lg:static lg:p-0 lg:bg-transparent lg:justify-start lg:flex'
                      : 'hidden lg:flex'
                    : 'flex flex-1 lg:flex-none'
                }
              `}
            >
              {/* Modal Header with Cross Button (Only visible in mobile overlay mode) */}
              {canDraw && showChatMobile && (
                <div className="lg:hidden flex justify-between items-center mb-3 w-full max-w-md mx-auto">
                  <span className="font-black text-white text-xl drop-shadow-md">Live Chat</span>
                  <button
                    onClick={() => setShowChatMobile(false)}
                    className="w-12 h-12 flex items-center justify-center rounded-full bg-red-500 dark:bg-neon-pink text-white text-xl font-black shadow-lg border-b-4 border-red-700 dark:border-pink-800 hover:bg-red-600 dark:hover:bg-pink-600 active:border-b-0 active:translate-y-1 transition-all"
                    aria-label="Close Chat"
                  >
                    <X size={24} strokeWidth={3.5} />
                  </button>
                </div>
              )}

              {/* The Chat Box Container: Constrained on mobile so it looks like a popup, but full flex on desktop */}
              <div
                className={`flex-1 min-h-0 flex flex-col ${canDraw && showChatMobile ? 'max-h-[70vh] w-full max-w-md mx-auto bg-white dark:bg-discord-card rounded-2xl shadow-2xl overflow-hidden' : ''}`}
              >
                <ArenaChat />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Global Modals */}
      <GameOverModal
        isOpen={gameState === GameState.GAME_END}
        standings={standings || []}
        isHost={isHost}
        onPlayAgain={handleReturnToLobby}
        onLeaveRoom={handleLeaveRoom}
      />
      <ConfirmModal
        isOpen={isLeaveModalOpen}
        title="Abandon Game?"
        description="Are you sure you want to forfeit and leave the room?  Your current score will be permanently lost."
        confirmText="Yes, Forfeit"
        cancelText="Keep Playing"
        onConfirm={handleLeaveRoom}
        onCancel={() => setIsLeaveModalOpen(false)}
      />
    </>
  );
};
