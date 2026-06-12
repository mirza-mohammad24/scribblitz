/**
 * This component renders a canvas element that serves as the drawing area for the game. It uses the
 * useCanvasDrawing hook to handle all drawing logic, including pointer events and real-time synchronization
 * with other players via WebSockets. The canvas is styled to look like a piece of paper, and it supports both
 * mouse and touch input for a seamless drawing experience across devices. The component also ensures that
 * non-drawing players cannot interact with the canvas, maintaining the integrity of the game.
 */

'use client';

import { useState, useEffect } from 'react';
import { DrawingCanvas } from '../components/Canvas/DrawingCanvas';
import { ThemeToggle } from '../components/ThemeToggle';
import { useGameSocket } from '../hooks/useGameSocket';
import { useGameStore } from '../store/gameStore';
import { ClientEvents, ServerEvents, GameState, RoomConfig } from '@scribblitz/types';
import { ChatBox } from '@/components/Chat/ChatBox';
import { GameHUD } from '@/components/Game/GameHUD';

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

  const [joinCodeInput, setJoinCodeInput] = useState('');
  const [username, setUsername] = useState('');

  // ==========================================
  // SOCKET LISTENERS
  // ==========================================
  useEffect(() => {
    if (!socket) return;

    socket.on(ServerEvents.ROOM_CREATED, ({ room }) => setRoomState(room));
    socket.on(ServerEvents.ROOM_JOINED, ({ room }) => setRoomState(room));

    //  NEW: Listen for the new lobby reset event
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
    // ROUND MANAGER FLOW (F6, F7, F8 Fixed)
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

    socket.on(ServerEvents.ROUND_END, ({ correctWord, reason, scores }) => {
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
    });

    socket.on(ServerEvents.GAME_END, ({ standings }) => {
      setRoomState({ gameState: GameState.GAME_END, standings });
    });

    // ==========================================
    // CHAT & GAMEPLAY LISTENERS (F5 Fixed)
    // ==========================================
    socket.on(ServerEvents.WORD_HINT_UPDATED, ({ hint }) => {
      setRoomState({ currentHint: hint });
    });

    socket.on(ServerEvents.CHAT_BROADCAST, (msg) => {
      const currentMessages = useGameStore.getState().chatMessages || [];
      setRoomState({ chatMessages: [...currentMessages, msg] });
    });

    socket.on(ServerEvents.PLAYER_GUESSED, ({ playerId, username }) => {
      // Update the UI to show this player guessed correctly (e.g., turn their name green)
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
      // Temporary alert - can be replaced with a beautiful Toast notification later
      alert(`Correct! You earned +${pointsEarned} points!`);
    });

    socket.on(ServerEvents.ERROR, (error) =>
      alert(`Server Error: ${error.message || JSON.stringify(error)}`),
    );

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
  }, [socket, setRoomState]);

  // ==========================================
  // ACTIONS
  // ==========================================
  const handleCreateRoom = () => {
    if (!socket?.connected) socket?.connect(); // Ensure the socket is connected before emitting

    socket?.emit(ClientEvents.ROOM_CREATE, {
      username,
      config: { maxPlayer: 8, drawTimeSeconds: 80, roundCount: 3, mode: 'standard' },
    });
  };

  const handleJoinRoom = () => {
    if (!socket?.connected) socket?.connect(); // Ensure the socket is connected before emitting
    socket?.emit(ClientEvents.ROOM_JOIN, { username, roomCode: joinCodeInput });
  };

  const handleStartGame = () => socket?.emit(ClientEvents.GAME_START, {});

  const updateConfig = (newConfig: Partial<RoomConfig>) =>
    socket?.emit(ClientEvents.ROOM_UPDATE_CONFIG, newConfig);

  const handleWordSelect = (word: string) => socket?.emit(ClientEvents.WORD_SELECT, { word });

  const handleLeaveRoom = () => {
    socket?.emit(ClientEvents.ROOM_LEAVE);
    resetGame();
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
    <main className="flex min-h-screen flex-col items-center p-6 transition-colors duration-300">
      {/* HEADER */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-8 z-10">
        <div>
          <h1 className="text-4xl font-bold text-blue-600">Scribblitz Engine</h1>
          <span className="text-sm font-medium text-gray-500">
            {isConnected ? '🟢 Server Connected' : '🔴 Connecting...'}
          </span>
        </div>
        <ThemeToggle />
      </div>

      {/* ZONE 1: SPLASH SCREEN */}
      {gameState === null && (
        <div className="bg-white p-8 rounded-xl shadow-lg border w-full max-w-md flex flex-col gap-4">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="p-3 border rounded"
          />
          <button
            onClick={handleCreateRoom}
            disabled={!username}
            className="bg-blue-600 text-white py-3 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Create Room
          </button>
          <hr />
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="CODE"
              value={joinCodeInput}
              onChange={(e) => setJoinCodeInput(e.target.value.toUpperCase())}
              maxLength={6}
              className="flex-1 p-3 border rounded"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!joinCodeInput || !username}
              className="bg-purple-600 text-white px-6 rounded font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Join
            </button>
          </div>
        </div>
      )}

      {/* ZONE 2: VIP LOUNGE */}
      {gameState === GameState.LOBBY && (
        <div className="w-full max-w-4xl grid grid-cols-2 gap-6 bg-white p-6 rounded-xl border shadow">
          <div className="flex flex-col gap-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-bold">Settings</h2>
              <button
                onClick={handleLeaveRoom}
                className="text-red-500 text-sm font-bold border border-red-500 px-3 py-1 rounded"
              >
                Leave Room
              </button>
            </div>
            <label>
              Rounds:{' '}
              <input
                type="range"
                min="1"
                max="10"
                value={config?.roundCount || 3}
                onChange={(e) => updateConfig({ roundCount: parseInt(e.target.value) })}
                disabled={!isHost}
              />
            </label>
            <label>
              Time:{' '}
              <input
                type="range"
                min="60"
                max="180"
                step="10"
                value={config?.drawTimeSeconds || 80}
                onChange={(e) => updateConfig({ drawTimeSeconds: parseInt(e.target.value) })}
                disabled={!isHost}
              />
            </label>
            {isHost ? (
              <button
                onClick={handleStartGame}
                className="bg-green-500 text-white py-3 mt-4 rounded font-bold"
              >
                START GAME
              </button>
            ) : (
              <div>Waiting for host...</div>
            )}
          </div>
          <div>
            <h2 className="text-xl font-bold mb-4">Players - Code: {roomCode}</h2>
            {players.map((p) => (
              <div key={p.id} className="p-2 border-b flex justify-between">
                <span>
                  {p.username} {p.id === hostId && '👑'}
                </span>
                {/* Visual feedback if a player is disconnected */}
                {!p.isConnected && (
                  <span className="text-red-500 text-xs font-bold">DISCONNECTED</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ZONE 3: THE GAME ARENA */}
      {gameState !== null && gameState !== GameState.LOBBY && (
        <div className="w-full flex flex-col items-center gap-4">
          <div className="w-full max-w-4xl flex justify-end">
            <button
              onClick={handleLeaveRoom}
              className="text-red-500 text-sm font-bold hover:underline"
            >
              Leave Game
            </button>
          </div>

          {/* WORD SELECTION INTERFACE */}
          {gameState === GameState.ROUND_STARTING && (
            <div className="w-full max-w-4xl bg-yellow-100 border-2 border-yellow-400 p-6 rounded-xl text-center mb-4">
              {isAssignedDrawer ? (
                <div className="flex flex-col items-center gap-4">
                  <h2 className="text-2xl font-bold text-black">Pick a Word!</h2>
                  <div className="flex gap-4">
                    {/* Safe mapping with optional chaining */}
                    {wordChoices?.map((word) => (
                      <button
                        key={word}
                        onClick={() => handleWordSelect(word)}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg font-bold text-xl hover:bg-blue-500"
                      >
                        {word}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <h2 className="text-2xl font-bold text-black animate-pulse">
                  Waiting for the Drawer to pick a word...
                </h2>
              )}
            </div>
          )}

          {/* GAME END OVERLAY */}
          {gameState === GameState.GAME_END && (
            <div className="w-full max-w-4xl bg-purple-100 border-2 border-purple-400 p-6 rounded-xl text-center mb-4 flex flex-col items-center gap-4">
              <h2 className="text-3xl font-bold text-purple-800">Game Over!</h2>

              {/* Leaderboard */}
              <div className="flex flex-col gap-2 w-full max-w-md bg-white p-4 rounded shadow text-left">
                <h3 className="text-xl font-bold text-center border-b pb-2 mb-2">
                  Final Standings
                </h3>
                {standings?.map((player) => (
                  <div
                    key={player.id}
                    className="flex justify-between items-center bg-gray-50 p-2 rounded"
                  >
                    <span className="font-bold">
                      {player.rank === 1
                        ? '🥇'
                        : player.rank === 2
                          ? '🥈'
                          : player.rank === 3
                            ? '🥉'
                            : `#${player.rank}`}{' '}
                      {player.username}
                    </span>
                    <span className="font-bold text-green-600">{player.score} pts</span>
                  </div>
                ))}
              </div>

              {/* 🌟 FIX: The Missing Return to Lobby Button! */}
              {isHost ? (
                <button
                  onClick={handleReturnToLobby}
                  className="bg-green-500 text-white px-8 py-3 rounded-lg font-bold text-xl hover:bg-green-600 shadow-lg mt-4"
                >
                  Play Again (Return to Lobby)
                </button>
              ) : (
                <h3 className="text-xl font-bold text-gray-600 animate-pulse mt-4">
                  Waiting for Host to start a new game...
                </h3>
              )}
            </div>
          )}

          {/* THE GAME GRID: Canvas on the left, Chat on the right */}
          <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-[1fr_350px] gap-6 items-start">
            {/* Left Column: Canvas & Controls */}
            <div className="flex flex-col w-full gap-2">
              <GameHUD />
              <div className="flex justify-between w-full px-4 py-2 font-bold bg-white border rounded">
                <span>State: {gameState}</span>
                <span>Role: {isAssignedDrawer ? '✏️ Drawer' : '👀 Watcher'}</span>
              </div>
              <DrawingCanvas isDrawer={canDraw} roomCode={roomCode!} />
            </div>

            {/* Right Column: Chat Box */}
            <div className="w-full flex justify-center">
              <ChatBox />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
