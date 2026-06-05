import { io } from 'socket.io-client';
import crypto from 'crypto';
import { ClientEvents, ServerEvents, GameState } from '@scribblitz/types';

console.log('🚀 [Test] Starting Two-Player Network Integration Test...\n');

const hostId = crypto.randomUUID();
const player2Id = crypto.randomUUID();
let sharedRoomCode = '';

// --- PLAYER 1 (THE HOST) ---
const p1Socket = io('http://localhost:3001', { auth: { token: hostId } });

p1Socket.on('connect', () => {
  console.log('✅ [Player 1] Connected. Creating room...');
  p1Socket.emit(ClientEvents.ROOM_CREATE, {
    username: 'Host_Player',
    config: { maxPlayers: 8, drawTimeSeconds: 60, roundCount: 3, language: 'en' },
  });
});

p1Socket.on(ServerEvents.ROOM_CREATED, (payload) => {
  if (sharedRoomCode) return; // Ignore reconnect syncs

  sharedRoomCode = payload.room.roomCode;
  console.log(`🏠 [Player 1] Room Created successfully! Code: ${sharedRoomCode}`);

  // Now that the room exists, tell Player 2 to join!
  startPlayer2();
});

p1Socket.on(ServerEvents.PLAYER_JOINED, (payload) => {
  console.log(`👋 [Player 1] Saw someone join the room: ${payload.player.username}`);
  console.log('🎮 [Player 1] We have enough players. Starting the game!');

  // Host starts the game
  p1Socket.emit(ClientEvents.GAME_START);
});

// --- PLAYER 2 (THE GUEST) ---
const p2Socket = io('http://localhost:3001', { auth: { token: player2Id }, autoConnect: false });

function startPlayer2() {
  p2Socket.connect();
}

p2Socket.on('connect', () => {
  console.log(`✅ [Player 2] Connected. Joining room: ${sharedRoomCode}...`);
  p2Socket.emit(ClientEvents.ROOM_JOIN, {
    roomCode: sharedRoomCode,
    username: 'Guest_Player',
  });
});

p2Socket.on(ServerEvents.ROOM_JOINED, () => {
  console.log('🏠 [Player 2] Successfully joined the room!');
});

// --- LISTEN FOR THE GAME TO START ---
const handleGameStateChange = (socketName: string) => (payload: any) => {
  console.log(`⚙️  [${socketName}] FSM Transitioned to: ${payload.state || payload.gameState}`);

  if (
    payload.state === GameState.ROUND_STARTING ||
    payload.gameState === GameState.ROUND_STARTING
  ) {
    console.log(
      `\n🎉 [${socketName}] IT WORKS! The Game Loop has officially started over the network!`,
    );

    // Disconnect safely after proving it works
    setTimeout(() => process.exit(0), 1000);
  }
};

p1Socket.on(ServerEvents.GAME_STATE_CHANGED, handleGameStateChange('Player 1'));
p2Socket.on(ServerEvents.GAME_STATE_CHANGED, handleGameStateChange('Player 2'));

// --- ERROR HANDLING ---
p1Socket.on(ServerEvents.ERROR, (err) => console.error('❌ [Player 1] Error:', err));
p2Socket.on(ServerEvents.ERROR, (err) => console.error('❌ [Player 2] Error:', err));
