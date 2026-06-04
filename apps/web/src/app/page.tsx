'use client';

import { useGameSocket } from '../hooks/useGameSocket';
import { ClientEvents } from '@scribblitz/types';

export default function Home() {
  const { socket, isConnected } = useGameSocket();

  const handleCreateQuickGame = () => {
    if (!socket) return;

    socket.emit(ClientEvents.ROOM_CREATE, {
      username: 'TestPlayer1',
    });
  };

  return (
    <div style={{ padding: '2rem', fontFamily: 'sans-serif' }}>
      <h1>Scribblitz Server Connection Test</h1>

      <div style={{ margin: '2rem 0', padding: '1rem', border: '1px solid #ccc' }}>
        <h2>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</h2>
        <p>
          If this is green, your Next.js app has successfully established a WebSocket connection
          with your Express server!
        </p>
      </div>

      <button
        onClick={handleCreateQuickGame}
        disabled={!isConnected}
        style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
      >
        Test: Create Room
      </button>

      <p style={{ marginTop: '1rem', fontSize: '14px', color: 'gray' }}>
        (Click the button and check your backend terminal for the log!)
      </p>
    </div>
  );
}
