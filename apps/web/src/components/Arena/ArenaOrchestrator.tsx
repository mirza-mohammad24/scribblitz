'use client';

/**
 * @file ArenaOrchestrator.tsx — Top-level game state orchestrator for Scribblitz.
 *
 * This component serves as the **single source of orchestration** for the entire
 * multiplayer game lifecycle. It does NOT own any game logic itself — instead, it:
 *
 * 1. Listens to every relevant Socket.IO server event and writes the payload
 *    directly into the Zustand game store via `setRoomState`.
 *
 * 2. Dispatches client-side socket emissions (start, leave, word select, etc.)
 *    through thin action handlers.
 *
 * 3. Renders the correct screen zone based on the current `gameState`:
 *    - Zone 1: HomeScreen (create / join) when `gameState === null`
 *    - Zone 2: LobbyScreen when `gameState === LOBBY`
 *    - Zone 3: Game Arena (HUD, Canvas, Chat, Leaderboard) for all other states
 *
 * 4. Manages UI micro-state that is local to the Arena shell (mobile player
 *    list toggle, leave-confirmation modal, mobile chat peek overlay).
 *
 * Socket listener groups (registered in a single `useEffect`):
 * - Room lifecycle: ROOM_CREATED, ROOM_JOINED, LOBBY_RESET, PLAYER_JOINED/LEFT,
 *   PLAYER_DISCONNECTED, HOST_CHANGED, ROOM_CONFIG_UPDATED, GAME_STATE_CHANGED
 * - Round manager flow: ROUND_STARTING, WORD_CHOICES, ROUND_STARTED, ROUND_END,
 *   GAME_END
 * - Chat & gameplay: WORD_HINT_UPDATED, CHAT_BROADCAST, GUESS_CLOSE,
 *   PLAYER_GUESSED, SCORE_UPDATE, GUESS_CORRECT
 * - Error handling: ERROR (fatal vs. non-fatal with toast routing)
 *
 * All listeners are explicitly unregistered on unmount to avoid leaks.
 *
 * @see {@link ArenaHUD} — heads-up display with timer, hint, and round info
 * @see {@link ArenaCanvas} — drawing surface with toolbox
 * @see {@link ArenaChat} — real-time guess/chat panel
 * @see {@link ArenaLeaderboard} — sorted player ranking sidebar
 */

import { useState, useEffect } from 'react';
import { useGameStore, PlayerStanding, ChatMessage } from '@/store/gameStore';
import { useToastStore } from '@/store/toastStore';
import { useGameSocket, ACTIVE_ROOM_KEY } from '@/hooks/useGameSocket';
import {
  ClientEvents,
  ServerEvents,
  GameState,
  RoomConfig,
  GameError,
  ErrorCode,
  Player,
  SerializedRoom,
} from '@scribblitz/types';
import { GAME_CONSTANTS } from '@scribblitz/shared';
import { MessageCircle, X } from 'lucide-react';
import { AnimatePresence } from 'framer-motion';

// Screens
import { HomeScreen } from '@/components/Home/HomeScreen';
import { LobbyScreen } from '@/components/Lobby/LobbyScreen';

// Modals
import { ConfirmModal } from '@/components/ui/ConfirmModal';
import { GameOverModal } from '@/components/ui/GameOverModal';
import { RoundEndOverlay } from '@/components/ui/RoundEndOverlay';
import { WordSelectionOverlay } from '@/components/ui/WordSelectionOverlay';
import { GameAbortedModal } from '@/components/ui/GameAbortModal';

// Arena Components
import { ArenaHUD } from './ArenaHUD';
import { ArenaCanvas } from './ArenaCanvas';
import { ArenaChat } from './ArenaChat';
import { ArenaLeaderboard } from './ArenaLeaderboard';

/**
 * Top-level orchestrator component that manages the full game lifecycle.
 *
 * Owns all Socket.IO event listeners, delegates rendering to zone-specific
 * child components (HomeScreen, LobbyScreen, Arena), and exposes thin action
 * handlers for game operations (start, leave, word select, config update).
 *
 * @returns The composed game UI — one of HomeScreen, LobbyScreen, or the full
 *          Arena layout with HUD, Canvas, Chat, and Leaderboard.
 */
export const ArenaOrchestrator = () => {
  const { socket, userId } = useGameSocket();
  const {
    gameState,
    roomCode,
    players,
    config,
    hostId,
    currentDrawerId,
    wordChoices,
    standings,
    isGameAborted,
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

    const handleRoomCreated = ({ room }: { room: SerializedRoom }) => {
      // Save active room code to localStorage for smart reconnection
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomCode);
      setRoomState(room);
    };

    const handleRoomJoined = ({
      room,
      serverNow,
    }: {
      room: SerializedRoom;
      serverNow?: number;
    }) => {
      // Save active room code to localStorage for smart reconnection
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomCode);

      //RECONNECT DRIFT CALCULATION
      let localPhaseEndTime = null;
      const phaseEndsAt = room.phaseEndTime;

      if (phaseEndsAt) {
        const referenceTime = serverNow || Date.now();
        const timeRemainingMs = Math.max(0, phaseEndsAt - referenceTime);
        localPhaseEndTime = Date.now() + timeRemainingMs;
      }
      // Reset chat messages on join to avoid showing stale messages from previous sessions
      setRoomState({
        ...room,
        chatMessages: [],
        totalRounds: room.config?.roundCount ?? 0,
        localPhaseEndTime,
      });
    };

    const handleLobbyReset = ({ room }: { room: SerializedRoom }) => {
      // Ensure the key is restored if the user refresh during the post-game lobby
      localStorage.setItem(ACTIVE_ROOM_KEY, room.roomCode);
      resetGame();
      setRoomState(room);
    };

    const handlePlayerJoined = ({ player }: { player: Player }) => {
      const existing = useGameStore.getState().players;
      const filtered = existing.filter((p) => p.id !== player.id);
      setRoomState({ players: [...filtered, player] });
    };

    const handlePlayerLeft = ({ playerId }: { playerId: string }) =>
      setRoomState({ players: useGameStore.getState().players.filter((p) => p.id !== playerId) });

    //  Handle disconnections and host migrations
    const handlePlayerDisconnected = ({ playerId }: { playerId: string }) => {
      const updatedPlayers = useGameStore
        .getState()
        .players.map((p) => (p.id === playerId ? { ...p, isConnected: false } : p));
      setRoomState({ players: updatedPlayers });
    };

    const handleHostChanged = ({ newHostId }: { newHostId: string }) => {
      setRoomState({ hostId: newHostId });
    };

    const handleRoomConfigUpdated = ({ config }: { config: RoomConfig }) =>
      setRoomState({ config });

    const handleGameStateChanged = ({ state }: { state: GameState }) =>
      setRoomState({ gameState: state });

    // ==========================================
    // ROUND MANAGER FLOW
    // ==========================================
    const handleRoundStarting = ({
      drawerId,
      round,
      totalRounds,
      roundId,
      timeRemainingMs,
    }: {
      drawerId: string;
      round: number;
      totalRounds: number;
      roundId: number;
      timeRemainingMs: number;
    }) => {
      //Capture the current scores before the round starts so we can use
      //them for the "score delta" in the post-round overlay
      const currentStore = useGameStore.getState();
      const previousScores: Record<string, number> = {};

      currentStore.players.forEach((p) => {
        previousScores[p.id] = p.score;
      });
      // Reset the "hasGuessedCorrectly" status for all players at the start of each round
      const resetPlayers = currentStore.players.map((p) => ({
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
        previousScores,
        localPhaseEndTime: Date.now() + timeRemainingMs,
      });
    };

    const handleWordChoices = ({ words }: { words: string[] }) => {
      setRoomState({ wordChoices: words });
    };

    const handleRoundStarted = ({
      drawerId,
      wordLength,
      wordHint,
      timeRemainingMs,
    }: {
      drawerId: string;
      wordLength: number;
      wordHint: string;
      timeRemainingMs: number;
    }) => {
      setRoomState({
        currentDrawerId: drawerId,
        wordLength,
        currentHint: wordHint,
        localPhaseEndTime: Date.now() + timeRemainingMs,
        gameState: GameState.DRAWING,
        wordChoices: [],
      });
    };

    const handleRoundEnd = ({
      correctWord,
      reason,
      scores,
      isFinalRound,
      timeRemainingMs,
    }: {
      correctWord: string;
      reason: string;
      scores: Array<{ id: string; username: string; score: number }>;
      isFinalRound?: boolean;
      timeRemainingMs: number;
    }) => {
      const currentPlayers = useGameStore.getState().players;

      const updatedPlayers = currentPlayers.map((p) => {
        const updated = scores.find((s) => s.id === p.id);
        return updated ? { ...p, score: updated.score } : p;
      });
      setRoomState({
        gameState: GameState.ROUND_END,
        correctWord,
        roundEndReason: reason,
        scores,
        players: updatedPlayers,
        isFinalRound: isFinalRound || false,
        localPhaseEndTime: Date.now() + timeRemainingMs,
      });
    };

    const handleGameEnd = ({ standings }: { standings: PlayerStanding[] }) => {
      //We don't delete the active room key from localstorage here because the user may want to return to the
      //post-game lobby to play again
      setRoomState({ gameState: GameState.GAME_END, standings });
    };

    const handleGameAborted = ({ reason }: { reason: string }) => {
      //We will delete the active room key from local storage here because now this room will never be
      //reused. I have already added to remove the active room key in the leave room handler, but if the
      //person did not click leave room and refreshes the page so deleting as soon as the server sends the
      //game abort event it is good to remove it here as well to prevent any stale reconnection attempts.
      localStorage.removeItem(ACTIVE_ROOM_KEY);

      setRoomState({
        gameState: GameState.GAME_END,
        isGameAborted: true,
        abortReason: reason,
      });
    };

    // ==========================================
    // CHAT & GAMEPLAY LISTENERS
    // ==========================================
    const handleWordHintUpdated = ({ hint }: { hint: string }) => {
      setRoomState({ currentHint: hint });
    };

    const handleChatBroadcast = (msg: ChatMessage) => {
      const currentMessages = useGameStore.getState().chatMessages || [];
      setRoomState({ chatMessages: [...currentMessages, msg] });
    };

    const handleGuessClose = ({ message }: { message: string }) => {
      const currentMessages = useGameStore.getState().chatMessages || [];
      setRoomState({
        chatMessages: [
          ...currentMessages,
          {
            senderId: 'system',
            senderName: 'System',
            message: message,
            isSystem: true,
            isCloseGuess: true,
          },
        ],
      });
    };

    const handlePlayerGuessed = ({
      playerId,
      username,
    }: {
      playerId: string;
      username: string;
    }) => {
      //Fresh state snapshot from gameStore
      const currentState = useGameStore.getState();

      //Update the UI to show this player guessed correctly (turn their name green)
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

      // Update both the player list and the chat simultaneously
      setRoomState({
        players: updatedPlayers,
        chatMessages: [...currentMessages, systemMessage],
      });
    };

    // Instantly updates the Zustand store with new scores whenever the server
    // broadcasts a score update (after a correct guess or at round end)
    const handleScoreUpdate = ({ scores }: { scores: Array<{ id: string; score: number }> }) => {
      const updatedPlayers = useGameStore.getState().players.map((p) => {
        const updated = scores.find((s) => s.id === p.id);
        return updated ? { ...p, score: updated.score } : p;
      });
      setRoomState({ players: updatedPlayers });
    };

    const handleGuessCorrect = ({ pointsEarned }: { pointsEarned: number }) => {
      addToast(`Correct! You earned +${pointsEarned} points!`, 'success');
    };

    // Deterministic Error Handling with standardized payload from the server
    const handleError = (error: GameError) => {
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

        //Only show a scary red error toast if it was an active user failure
        if (error.code !== ErrorCode.SESSION_EXPIRED) {
          addToast(message, 'error');
        }
      } else {
        // Just a standard notice (e.g., UNAUTHORIZED for clicking start as a non-host)
        addToast(message, 'info');
      }
    };

    socket.on(ServerEvents.ROOM_CREATED, handleRoomCreated);
    socket.on(ServerEvents.ROOM_JOINED, handleRoomJoined);
    socket.on(ServerEvents.LOBBY_RESET, handleLobbyReset);
    socket.on(ServerEvents.PLAYER_JOINED, handlePlayerJoined);
    socket.on(ServerEvents.PLAYER_LEFT, handlePlayerLeft);
    socket.on(ServerEvents.PLAYER_DISCONNECTED, handlePlayerDisconnected);
    socket.on(ServerEvents.HOST_CHANGED, handleHostChanged);
    socket.on(ServerEvents.ROOM_CONFIG_UPDATED, handleRoomConfigUpdated);
    socket.on(ServerEvents.GAME_STATE_CHANGED, handleGameStateChanged);
    socket.on(ServerEvents.ROUND_STARTING, handleRoundStarting);
    socket.on(ServerEvents.WORD_CHOICES, handleWordChoices);
    socket.on(ServerEvents.ROUND_STARTED, handleRoundStarted);
    socket.on(ServerEvents.ROUND_END, handleRoundEnd);
    socket.on(ServerEvents.GAME_END, handleGameEnd);
    socket.on(ServerEvents.GAME_ABORTED, handleGameAborted);
    socket.on(ServerEvents.WORD_HINT_UPDATED, handleWordHintUpdated);
    socket.on(ServerEvents.CHAT_BROADCAST, handleChatBroadcast);
    socket.on(ServerEvents.GUESS_CLOSE, handleGuessClose);
    socket.on(ServerEvents.PLAYER_GUESSED, handlePlayerGuessed);
    socket.on(ServerEvents.SCORE_UPDATE, handleScoreUpdate);
    socket.on(ServerEvents.GUESS_CORRECT, handleGuessCorrect);
    socket.on(ServerEvents.ERROR, handleError);

    // Clean up listeners on unmount.
    // Passing the exact handler reference (not just the event name) ensures other
    // components' listeners for the same event — e.g. useCanvasDrawing's ROOM_JOINED /
    // ROUND_STARTING / ROUND_END listeners — are never accidentally wiped out.
    return () => {
      socket.off(ServerEvents.ROOM_CREATED, handleRoomCreated);
      socket.off(ServerEvents.ROOM_JOINED, handleRoomJoined);
      socket.off(ServerEvents.LOBBY_RESET, handleLobbyReset);
      socket.off(ServerEvents.PLAYER_JOINED, handlePlayerJoined);
      socket.off(ServerEvents.PLAYER_LEFT, handlePlayerLeft);
      socket.off(ServerEvents.PLAYER_DISCONNECTED, handlePlayerDisconnected);
      socket.off(ServerEvents.HOST_CHANGED, handleHostChanged);
      socket.off(ServerEvents.ROOM_CONFIG_UPDATED, handleRoomConfigUpdated);
      socket.off(ServerEvents.GAME_STATE_CHANGED, handleGameStateChanged);
      socket.off(ServerEvents.ROUND_STARTING, handleRoundStarting);
      socket.off(ServerEvents.WORD_CHOICES, handleWordChoices);
      socket.off(ServerEvents.ROUND_STARTED, handleRoundStarted);
      socket.off(ServerEvents.ROUND_END, handleRoundEnd);
      socket.off(ServerEvents.GAME_END, handleGameEnd);
      socket.off(ServerEvents.GAME_ABORTED, handleGameAborted);
      socket.off(ServerEvents.WORD_HINT_UPDATED, handleWordHintUpdated);
      socket.off(ServerEvents.CHAT_BROADCAST, handleChatBroadcast);
      socket.off(ServerEvents.GUESS_CLOSE, handleGuessClose);
      socket.off(ServerEvents.PLAYER_GUESSED, handlePlayerGuessed);
      socket.off(ServerEvents.SCORE_UPDATE, handleScoreUpdate);
      socket.off(ServerEvents.GUESS_CORRECT, handleGuessCorrect);
      socket.off(ServerEvents.ERROR, handleError);
    };
  }, [socket, setRoomState, resetGame, addToast, userId]);

  // ==========================================
  // ACTIONS
  // ==========================================

  /**
   * Emits the GAME_START event to the server.
   * Only the host should invoke this; the server enforces authorization.
   */
  const handleStartGame = () => socket?.emit(ClientEvents.GAME_START, {});

  /**
   * Sends a partial room configuration update to the server.
   * The server merges the partial config with the existing room config.
   *
   * @param newConfig - A partial {@link RoomConfig} containing only the fields to update.
   */
  const updateConfig = (newConfig: Partial<RoomConfig>) =>
    socket?.emit(ClientEvents.ROOM_UPDATE_CONFIG, newConfig);

  /**
   * Emits the drawer's word selection to the server during the ROUND_STARTING phase.
   *
   * @param word - The word chosen by the drawer from the presented word choices.
   */
  const handleWordSelect = (word: string) => socket?.emit(ClientEvents.WORD_SELECT, { word });

  /**
   * Performs a hard leave from the current room.
   * Emits ROOM_LEAVE to the server, clears the active room from localStorage
   * (preventing stale reconnection attempts), and resets the local game store.
   */
  const handleLeaveRoom = () => {
    resetGame();
    localStorage.removeItem(ACTIVE_ROOM_KEY);
    setIsLeaveModalOpen(false);
    socket?.emit(ClientEvents.ROOM_LEAVE);
  };

  /**
   * Requests to leave the room by opening the confirmation modal.
   * Acts as a guard so that mid-game exits require explicit user confirmation
   * before calling {@link handleLeaveRoom}.
   */
  const requestLeaveRoom = () => {
    if (gameState !== null) {
      setIsLeaveModalOpen(true);
    }
  };

  /**
   * Emits RETURN_TO_LOBBY to the server after a game ends.
   * Only the host triggers this; the server resets all players back to the lobby.
   */
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
            <div className="hidden lg:flex w-60 xl:w-70 shrink-0 min-h-0 flex-col">
              <ArenaLeaderboard />
            </div>

            {/* CENTER COLUMN: CANVAS & TOOLBOX */}
            <div className="flex-1 flex flex-col gap-3 min-h-0 relative w-full lg:max-w-275 mx-auto">
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
              <AnimatePresence>
                {gameState === GameState.ROUND_STARTING && (
                  <WordSelectionOverlay
                    isDrawer={isAssignedDrawer}
                    wordChoices={wordChoices}
                    onSelect={handleWordSelect}
                  />
                )}
              </AnimatePresence>

              {/* ROUND END OVERLAY */}
              <AnimatePresence>
                {gameState === GameState.ROUND_END && !isGameAborted && <RoundEndOverlay />}
              </AnimatePresence>

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
        isOpen={gameState === GameState.GAME_END && !isGameAborted}
        standings={standings || []}
        isHost={isHost}
        onPlayAgain={handleReturnToLobby}
        onLeaveRoom={handleLeaveRoom}
      />

      <GameAbortedModal isOpen={isGameAborted} onGoHome={handleLeaveRoom} />

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
