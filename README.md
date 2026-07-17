<div align="center">
  <h1>
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./apps/web/public/icon-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="./apps/web/public/icon-light.svg">
      <img alt="Scribblitz Logo" src="./apps/web/public/icon-light.svg" width="36" height="36" style="vertical-align: middle; margin-right: 8px;">
    </picture>
    Scribblitz
  </h1>

  [![Status](https://img.shields.io/badge/Status-V1_MVP-success)](#)
  [![License](https://img.shields.io/badge/License-MIT-purple)](#)
  <br>
  [![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](#)
  [![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)](#)
  [![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)](#)
  [![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](#)
  [![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](#)
  [![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat&logo=turborepo&logoColor=white)](#)
  <br><br>

  > A high-performance multiplayer drawing and guessing game powered by a server-authoritative state machine, Redis-backed canvas history, and strict runtime payload validation.
 

  <img src="./assets/hero.gif" alt="Scribblitz Gameplay Demo" width="100%">
</div>


<p align="center">
  <img src="./assets/hero.gif" alt="Scribblitz Gameplay Demo" width="100%">
</p>

## ✨ Engineering Highlights

- **Server-authoritative Finite State Machine (FSM)** enforces valid game-state transitions and prevents illegal client actions.
- **Redis Streams** provide durable event sourcing for collaborative canvas reconstruction and reconnect recovery.
- **Persistent session mapping** allows players to reconnect without losing game state or identity.
- **Shared TypeScript contracts** eliminate payload inconsistencies between the Next.js frontend and Express backend.
- **Runtime Zod validation** rejects malformed Socket.IO payloads before they reach business logic.
- **16ms batched canvas synchronization** minimizes WebSocket overhead while preserving a smooth real-time drawing experience.
- **Automatic host migration** ensures multiplayer lobbies survive unexpected disconnects.
- **Graceful shutdown routines** clean up timers, Redis resources, and room state to prevent orphaned sessions.

---

## 🏗️ Architecture Overview

Scribblitz is a Turborepo monorepo with two runtime services sharing a common `@scribblitz/types` contract, so the client and server can never silently drift out of sync on payload shapes.

```mermaid
graph TD
    A[Browser] -->|HTTP + WebSocket| B[apps/web — Next.js 16]
    A -->|WebSocket| C[apps/game-server — Socket.IO + Express]
    C --> D[(Redis — canvas stream, pub/sub)]
    C --> E[(PostgreSQL — via Prisma)]
    F[apps/worker] -.->|stub, not yet wired to a queue| E

    subgraph "Docker Compose network"
        B
        C
        D
        E
    end
```

> `apps/worker` currently connects to Postgres and runs a heartbeat, but has no BullMQ consumers yet — see [Known Limitations](#-known-limitations-v1).

### Server-Authoritative Game Loop

Clients never mutate game state directly — every transition is validated and broadcast by the server's finite state machine (`GameFSM.ts`).

```mermaid
stateDiagram-v2
  [*] --> LOBBY
  LOBBY --> ROUND_STARTING : game:start (host, ≥2 players)
  ROUND_STARTING --> DRAWING : word selected (manual or AFK timeout)
  DRAWING --> ROUND_END : all guessed correctly OR draw timer expired
  ROUND_END --> ROUND_STARTING : intermission elapses, rounds remain
  ROUND_END --> GAME_END : intermission elapses, final round
  GAME_END --> LOBBY : host manually returns everyone to lobby
```

### Canvas Sync

Rather than emitting a network event on every single pointer-move, the client buffers strokes locally and flushes the buffer to the server on a fixed `setInterval` (`CANVAS_BATCH_INTERVAL_MS = 16`, defined once in `@scribblitz/shared` so client and server always agree on the cadence). The server relays each batch to other players in the room and simultaneously appends it to a Redis Stream (`room:<code>:canvas`), which is what makes canvas history replay possible for reconnecting or late-joining players.

```mermaid
sequenceDiagram
  participant D as Drawer
  participant S as game-server
  participant R as Redis Stream
  participant W as Watcher

  loop pointer move
    D->>D: draw locally, push to buffer
  end
  loop every 16ms (if buffer non-empty)
    D->>S: canvas:batch { strokes[] }
    S->>R: XADD room:<code>:canvas
    S->>W: canvas:batch { strokes[] }
  end

  Note over W: reconnect / late join
  W->>S: canvas:sync_request
  S->>R: XRANGE room:<code>:canvas - +
  R-->>S: full stream history
  S->>W: canvas:history { strokes[] }
```

---

## 🧠 Engineering & Gameplay Spotlights

### ⚡ Real-Time Systems & Resilience

- **Zero-Downtime Reconnects:**
  Player identities are mapped to persistent UUIDs stored in `localStorage`, decoupling gameplay sessions from volatile Socket.IO connection IDs. When a player disconnects, the server starts a 60-second reconnection window instead of immediately removing them from the room. Upon reconnection, the server performs an `XRANGE` query against the room's Redis Stream, allowing the client to replay the persisted canvas stroke history and reconstruct the drawing state without requiring a full room resynchronization.

- **16ms Batched Canvas Synchronization:**
  Streaming every `mousemove` event quickly overwhelms the network during rapid drawing. Instead, the client buffers strokes locally and flushes them every 16ms, while the server batches Redis writes using `ioredis` pipelines (`pipeline.xadd`) before broadcasting updates. This significantly reduces WebSocket traffic and Redis round-trips while maintaining smooth, real-time drawing.

- **Dynamic Host Migration:**
  If the lobby host disconnects or leaves unexpectedly, the game continues uninterrupted. The server automatically elects the next connected player as the new host and broadcasts a `room:host_changed` event, allowing multiplayer sessions to continue without manual intervention.

### 🛡️ Architecture & Security

- **Contract-Driven Monorepo:**
  Built as a Turborepo, the Next.js client and Express server share a single source of truth through the `@scribblitz/types` workspace. Every Socket.IO event, finite state machine transition, and payload interface is imported from the same package, eliminating API contract drift between frontend and backend.

- **Strict Runtime Validation:**
  Compile-time TypeScript safety alone cannot protect against malformed network requests. Every incoming Socket.IO payload is validated at runtime using Zod schemas (`@scribblitz/validation`) before reaching the core game logic. Invalid or malicious payloads are rejected immediately, ensuring consistent server-side data integrity.

### 🎮 Premium Gameplay UX

- **VIP Ghost Chat:**
  Once a player correctly guesses the word, their chat experience transitions into an isolated communication channel. The server routes their subsequent messages only to the Drawer and other successful guessers (`isGhost: true`), creating a private conversation without revealing the answer to players who are still guessing.

- **Forgiving Typo Engine:**
  Player guesses are processed through a custom Levenshtein distance algorithm before evaluation. If a guess falls within a configurable edit-distance threshold of the correct word, the server suppresses the public chat message and privately emits a `guess:close` event to that player, encouraging them without leaking information to the rest of the lobby.

- **Progressive Hint System:**
  To maintain engagement throughout each round, the server progressively reveals characters of the target word as the timer advances. Hint generation is entirely server-authoritative, ensuring every client receives synchronized updates through `word:hint_updated` events while preventing client-side manipulation.

---

## 💻 Tech Stack

| Technology              | Version         | Purpose                                                             |
| ----------------------- | --------------- | ------------------------------------------------------------------- |
| **TypeScript**          | `5.9`           | End-to-end type safety and shared monorepo contracts                |
| **Next.js / React**     | `16.2` / `19.2` | Frontend, with React Compiler enabled                               |
| **Tailwind CSS**        | `v4`            | Styling                                                             |
| **Zustand**             | `5.0`           | Client-side game state                                              |
| **Framer Motion**       | `12.x`          | Animation (podium, drag-to-dismiss sheets, timers)                  |
| **Express + Socket.IO** | `5.2` / `4.8`   | Real-time game server                                               |
| **ioredis**             | `5.11`          | Canvas stream buffering, connection state                           |
| **Prisma + PostgreSQL** | `7.8` / `16`    | Persistence layer (see [Known Limitations](#-known-limitations-v1)) |
| **Pino + pino-roll**    | `10.3` / `4.0`  | Structured, rotating production logs                                |
| **Zod**                 | `3.22`          | Runtime payload validation on every socket event                    |
| **Turborepo & pnpm**    | `2.9` / `11.5`  | Monorepo build orchestration and workspace management               |

---

## 📁 Project Structure

```text
scribblitz/
├── apps/
│   ├── web/                 # Next.js frontend — lobby, canvas, chat, HUD
│   ├── game-server/         # Socket.IO + Express — FSM, rooms, canvas relay, chat
│   └── worker/              # Background worker (stub — see Known Limitations)
├── packages/
│   ├── types/                # Shared TS types + Socket.IO event constants
│   ├── validation/           # Zod schemas for every client payload
│   ├── shared/                # Shared runtime constants (GAME_CONSTANTS)
│   ├── eslint-config/         # Shared ESLint configs
│   └── typescript-config/     # Shared tsconfig presets
├── prisma/                   # Schema + migrations (User, GameResult models)
├── docker-compose.yml         # Local dev: Postgres + Redis
├── docker-compose.prod.yml    # Production: full stack, resource limits, health checks
└── turbo.json                 # Build/dev/lint pipeline
```

---

## 🚀 Local Setup

**Prerequisites:** Node.js `24.16.0` (pinned in `.nvmrc`), pnpm `11.5.3`, Docker.

```bash
# 1. Clone and install
git clone <repo-url> scribblitz
cd scribblitz
nvm use # Automatically switches to Node 24.16.0 based on .nvmrc
pnpm install

# 2. Set up environment variables
cp .env.example .env
```

> **Note:** The .env.example ships with production-oriented values. For local development, you must update your new .env file to point at the Docker containers running on localhost. Match these exact values:

| Variable                      | Local Dev Value                                                                            | Reason                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | `postgresql://scribblitz:scribblitz_dev_secret@localhost:5432/scribblitz_db?schema=public` | Points to the local Docker PostgreSQL instance using the development credentials defined in `docker-compose.yml`. |
| `POSTGRES_PASSWORD`           | `scribblitz_dev_secret`                                                                    | Matches the password configured in `docker-compose.yml`.                                                          |
| `POSTGRES_USER`               | `scribblitz`                                                                               | Matches the PostgreSQL user configured in `docker-compose.yml`.                                                   |
| `REDIS_URL`                   | `redis://localhost:6379`                                                                   | Points to the local Docker Redis instance running without authentication.                                         |
| `REDIS_PASSWORD`              | _(Leave empty or remove)_                                                                  | Development Redis runs without a password.                                                                        |
| `NEXT_PUBLIC_GAME_SERVER_URL` | `http://localhost:3001`                                                                    | Points to the local Express + Socket.IO game server.                                                              |
| `WEB_URL`                     | `http://localhost:3000`                                                                    | Points to the local Next.js frontend application.                                                                 |

```bash
# 3. Start local Postgres + Redis
docker compose up -d

# 4. Run database migrations
pnpm exec prisma migrate dev

# 5. Start everything (web + game-server + worker) with hot reload
pnpm dev
```

Expected Local Ports:

- Web: `http://localhost:3000`
- Game server: `http://localhost:3001`

---

## 📡 Socket.IO Event Reference

<details>
<summary><strong>Client → Server Events</strong></summary>

| Event                  | Payload                              | Description                                   |
| ---------------------- | ------------------------------------ | --------------------------------------------- |
| `room:create`          | `{ username, avatarSeed, config? }`  | Create a new room                             |
| `room:join`            | `{ roomCode, username, avatarSeed }` | Join an existing room (lobby only)            |
| `room:leave`           | _(none)_                             | Permanently leave the current room            |
| `room:update_config`   | `Partial<RoomConfig>`                | Host updates room settings                    |
| `game:start`           | _(none)_                             | Host starts the game (≥2 players required)    |
| `word:select`          | `{ word }`                           | Drawer picks a word                           |
| `game:return_to_lobby` | _(none)_                             | Host returns everyone to lobby after game end |
| `canvas:batch`         | `{ strokes: StrokeEvent[] }`         | Buffered stroke batch, max 200, rate-limited  |
| `canvas:clear`         | _(none)_                             | Drawer clears the canvas                      |
| `canvas:undo`          | _(none)_                             | Drawer undoes the last stroke                 |
| `canvas:sync_request`  | `{ roomCode }`                       | Request full canvas history on join/reconnect |
| `chat:message`         | `{ message, roundId }`               | Chat message / guess attempt                  |

</details>

<details>
<summary><strong>Server → Client Events</strong></summary>

| Event                                                   | Payload                                                          | Description                                         |
| ------------------------------------------------------- | ---------------------------------------------------------------- | --------------------------------------------------- |
| `room:created` / `room:joined`                          | `{ room: SerializedRoom, serverNow? }`                           | Confirms create/join/reconnect with full room state |
| `player:joined` / `player:left` / `player:disconnected` | varies                                                           | Room membership changes                             |
| `room:host_changed`                                     | `{ newHostId }`                                                  | Host reassigned                                     |
| `room:config_updated`                                   | `{ config }`                                                     | Room settings changed                               |
| `game:state_changed`                                    | `{ state: GameState }`                                           | FSM transition broadcast                            |
| `round:starting`                                        | `{ round, totalRounds, drawerId, roundId, timeRemainingMs }`     | New round beginning, drawer chosen                  |
| `word:choices`                                          | `{ words }`                                                      | Private word options, drawer only                   |
| `drawer:word_reveal`                                    | `{ word }`                                                       | Private reveal of the chosen word, drawer only      |
| `round:started`                                         | `{ drawerId, wordLength, wordHint, timeRemainingMs }`            | Drawing phase begins                                |
| `word:hint_updated`                                     | `{ hint }`                                                       | Progressive hint reveal                             |
| `canvas:batch`                                          | `{ strokes }`                                                    | Relayed stroke batch                                |
| `canvas:history`                                        | `{ strokes }`                                                    | Full history for sync                               |
| `canvas:cleared` / `canvas:undone`                      | varies                                                           | Canvas mutation broadcasts                          |
| `chat:broadcast`                                        | `{ senderId, senderName, message, isSystem, isGhost? }`          | Public or Ghost Chat message                        |
| `player:guessed`                                        | `{ playerId, username }`                                         | Public "guessed correctly" notice                   |
| `guess:correct` / `guess:close`                         | varies                                                           | Private feedback to the guesser only                |
| `score:update`                                          | `{ scores }`                                                     | Score broadcast after a correct guess               |
| `round:end`                                             | `{ correctWord, reason, scores, isFinalRound, timeRemainingMs }` | Round concludes                                     |
| `game:end`                                              | `{ standings }`                                                  | Final ranked standings                              |
| `game:aborted`                                          | `{ reason }`                                                     | Game ended early — insufficient players             |
| `room:lobby_reset`                                      | `{ room }`                                                       | Everyone returned to lobby after game end           |
| `server:error`                                          | `{ code, message, isFatal }`                                     | Standardized error payload                          |

</details>

---

## 🔮 Roadmap

The `apps/worker` service and a few reserved event types (`emote:send`, `emote:broadcast`) are scaffolded but not yet implemented, laying the groundwork for V2:

1. **Voice Channels** — WebRTC voice integration for real-time audio communication during the game.
2. **LLM Custom Word Generation** — utilizing the background worker to interface with an LLM, allowing lobby hosts to dynamically generate themed custom word lists on the fly without blocking the main game server.
3. **Emote Reactions** — fully implementing the scaffolded socket events to allow players to send real-time visual reactions during the drawing phase.

---

## ⚠️ Known Limitations (v1)

- **In-memory game state** — all active rooms live in the game-server's process memory; a restart clears them. Redis is used for canvas history, not for cross-instance state.
- **No authentication** — player identity is a client-generated UUID in `localStorage`. The Prisma `User` model exists but isn't wired up yet.
- **`apps/worker` is a stub** — connects to Postgres, runs a heartbeat, has no job consumers yet.
- **Single-instance architecture** — no horizontal scaling; one Node.js process handles all rooms.

---

## 👨‍💻 Author

Built by **Mirza Mohammad Abbas** — [LinkedIn](https://www.linkedin.com/in/mirza-mohammad-abbas)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
