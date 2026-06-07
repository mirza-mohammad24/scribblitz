'use client';

import { useState, useEffect } from 'react';
import { DrawingCanvas } from '../components/Canvas/DrawingCanvas';
import { ThemeToggle } from '../components/ThemeToggle';
import { useGameSocket } from '../hooks/useGameSocket';
import { ClientEvents, ServerEvents } from '@scribblitz/types';

export default function Home() {
  const { socket, isConnected } = useGameSocket();

  const [isDrawer, setIsDrawer] = useState(true);
  const [joinCode, setJoinCode] = useState('');
  const [activeRoom, setActiveRoom] = useState<string | null>(null);

  // Listen for Server Lobby Responses
  useEffect(() => {
    if (!socket) return;

    // When we create a room, the server gives us the generated code
    socket.on(ServerEvents.ROOM_CREATED, (payload) => {
      console.log('Room Created:', payload.room.roomCode);
      setActiveRoom(payload.room.roomCode);
    });

    // When we join a room, the server confirms it
    socket.on(ServerEvents.ROOM_JOINED, (payload) => {
      console.log('Joined Room:', payload.room.roomCode);
      setActiveRoom(payload.room.roomCode);
    });

    return () => {
      socket.off(ServerEvents.ROOM_CREATED);
      socket.off(ServerEvents.ROOM_JOINED);
    };
  }, [socket]);

  const handleCreateRoom = () => {
    socket?.emit(ClientEvents.ROOM_CREATE, {
      username: 'Test_Drawer',
      config: { maxPlayers: 8, drawTimeSeconds: 60, roundCount: 3, language: 'en' },
    });
  };

  const handleJoinRoom = () => {
    if (!joinCode) return;
    socket?.emit(ClientEvents.ROOM_JOIN, {
      username: 'Test_Watcher',
      roomCode: joinCode.toUpperCase(),
    });
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-8 md:p-24 transition-colors duration-300">
      {/* HEADER SECTION WITH THEME TOGGLE */}
      <div className="w-full max-w-4xl flex justify-between items-center mb-8">
        <div>
          {/* Using your new Fredoka font! */}
          <h1 className="font-scribble text-4xl text-blue-600 dark:text-blue-400">
            Scribblitz Engine
          </h1>
          <p className="text-gray-600 dark:text-gray-400 font-sans mt-2">
            Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
          </p>
        </div>

        {/* THEME BUTTONS ARE HERE */}
        <ThemeToggle />
      </div>

      {/* MICRO LOBBY UI (Disappears once you join a room) */}
      {!activeRoom ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 w-full max-w-md flex flex-col gap-6 transition-colors duration-300">
          <h2 className="text-2xl font-bold font-scribble text-gray-900 dark:text-white">
            Game Setup
          </h2>

          <label className="flex items-center gap-3 cursor-pointer text-gray-700 dark:text-gray-300 font-medium">
            <input
              type="checkbox"
              checked={isDrawer}
              onChange={(e) => setIsDrawer(e.target.checked)}
              className="w-5 h-5 accent-blue-600 rounded"
            />
            <span>I am the Drawer</span>
          </label>

          <hr className="border-gray-200 dark:border-gray-700" />

          <button
            onClick={handleCreateRoom}
            disabled={!isConnected}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            Create New Room
          </button>

          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Paste Code Here"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-900 dark:text-white uppercase font-mono placeholder:normal-case transition-colors"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!isConnected || !joinCode}
              className="bg-green-600 text-white px-6 rounded-xl font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
            >
              Join
            </button>
          </div>
        </div>
      ) : (
        /* THE ACTUAL WORKSPACE & CANVAS (Appears after joining) */
        <div className="w-full flex flex-col items-center gap-4">
          <div className="flex justify-between w-full max-w-4xl px-6 py-4 font-bold text-lg bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-xl transition-colors duration-300">
            <span className="text-gray-800 dark:text-gray-200">
              Role: {isDrawer ? '✏️ Drawer' : '👀 Watcher'}
            </span>
            <span className="tracking-widest text-gray-800 dark:text-gray-200 font-mono">
              Room Code: <span className="text-blue-600 dark:text-blue-400">{activeRoom}</span>
            </span>
          </div>

          <DrawingCanvas isDrawer={isDrawer} roomCode={activeRoom} />
        </div>
      )}
    </main>
  );
}
