import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { GAME_CONSTANTS } from '@scribblitz/shared';

const app = express();
const server = http.createServer(app);

//Initialize Socket.IO with relaxed CORS for local dev
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

//Essential Health Check Route (Used by Docker/Deployment later)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'game-server',
    timeStamp: Date.now(),
  });
});

io.on('connection', (socket) => {
  console.log(`[Socket] Player connected: ${socket.id}`);

  socket.on('disconnect', () => {
    console.log(`[Socket] Player disconnected: ${socket.id}`);
  });
});

const PORT = process.env.PORT || 3001;

server.listen(PORT, () => {
  console.log(`Game Server is running on port ${PORT}`);
  console.log(`Max Player per room: ${GAME_CONSTANTS.MAX_PLAYERS}`);
});
