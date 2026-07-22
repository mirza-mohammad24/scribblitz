<div align="center">
  <h1>
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="./apps/web/public/icon-dark.svg">
      <source media="(prefers-color-scheme: light)" srcset="./apps/web/public/icon-light.svg">
      <img alt="Scribblitz Logo" src="./apps/web/public/icon-light.svg" width="36" height="36" style="vertical-align: middle; margin-right: 8px;">
    </picture>
    Scribblitz
  </h1>

[![Status](https://img.shields.io/badge/Status-V2_Release-success)](#)
[![License](https://img.shields.io/badge/License-MIT-purple)](#)
<br>
[![Next.js](https://img.shields.io/badge/Next.js-000000?style=flat&logo=next.js&logoColor=white)](#)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-010101?style=flat&logo=socket.io&logoColor=white)](#)
[![LiveKit](https://img.shields.io/badge/LiveKit-FF4785?style=flat&logo=livekit&logoColor=white)](#)
[![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat&logo=redis&logoColor=white)](#)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat&logo=postgresql&logoColor=white)](#)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat&logo=docker&logoColor=white)](#)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat&logo=typescript&logoColor=white)](#)
[![Turborepo](https://img.shields.io/badge/Turborepo-EF4444?style=flat&logo=turborepo&logoColor=white)](#)
<br><br>

> A high-performance multiplayer drawing and guessing game with real-time voice chat, AI-generated themed word packs, and a server-authoritative state machine — powered by Redis-backed canvas history, LiveKit WebRTC audio, and strict runtime payload validation.

  <img src="./assets/hero.gif" alt="Scribblitz Gameplay Demo" width="100%">
</div>

## ✨ Engineering Highlights

- **Server-authoritative Finite State Machine (FSM)** enforces valid game-state transitions and prevents illegal client actions.
- **Redis Streams** provide durable event sourcing for collaborative canvas reconstruction and reconnect recovery.
- **Real-time voice chat via LiveKit** — server-issued JWT access tokens let players communicate over low-latency WebRTC audio without any media passing through the game server.
- **AI-powered custom word generation** — a dedicated BullMQ worker uses Google Gemini 3.5 Flash to produce themed word packs (99 words per request) on demand, completely off the game-server hot path.
- **Persistent session mapping** allows players to reconnect within a 60-second grace window without losing game state or identity.
- **Shared TypeScript contracts** eliminate payload inconsistencies between the Next.js frontend and Express backend.
- **Runtime Zod validation** rejects malformed Socket.IO payloads before they reach business logic.
- **16ms batched canvas synchronization** minimizes WebSocket overhead while preserving a smooth ~60fps real-time drawing experience.
- **Fully responsive, mobile-first UI** with single-panel navigation on mobile and a three-column grid on desktop, built with advanced Framer Motion animations.
- **Instant dark/light theme toggling** using the View Transitions API with radial clip-path animations and dynamic favicon swapping — zero layout shift.
- **Automatic host migration** ensures multiplayer lobbies survive unexpected disconnects.
- **Graceful shutdown routines** clean up timers, BullMQ connections, Redis resources, and room state to prevent orphaned sessions.

---

## 🏗️ Architecture Overview

Scribblitz is a Turborepo monorepo with three runtime services sharing a common `@scribblitz/types` contract, so the client and server can never silently drift out of sync on payload shapes. Real-time gameplay flows through Socket.IO, voice communication is offloaded to LiveKit, and background AI word generation is brokered through BullMQ over Redis.

```mermaid
graph TD
    A[Browser] -->|HTTP + WebSocket| B["apps/web — Next.js 16"]
    A -->|WebSocket| C["apps/game-server — Socket.IO + Express"]
    A -->|WebRTC Audio| L["LiveKit Server (Cloud / Self-hosted)"]
    C -->|Mint JWT Token| L
    C --> D[("Redis — canvas stream, pub/sub, BullMQ")]
    C --> E[("PostgreSQL — via Prisma")]
    W["apps/worker — BullMQ + Gemini 3.5 Flash"] -->|Consume ai-theme-queue| D
    W -->|Return word list via job result| D

    subgraph "Docker Compose network"
        B
        C
        D
        E
        W
    end
```

### Server-Authoritative Game Loop

Clients never mutate game state directly — every transition is validated and broadcast by the server's finite state machine (`GameFSM.ts`).

```mermaid
stateDiagram-v2
  [*] --> LOBBY
  LOBBY --> ROUND_STARTING : game:start (host, ≥2 players)
  ROUND_STARTING --> DRAWING : word selected (manual or 15s AFK timeout)
  ROUND_STARTING --> ROUND_END : drawer disconnected during selection
  DRAWING --> ROUND_END : all guessed correctly OR draw timer expired
  ROUND_END --> ROUND_STARTING : intermission elapses, rounds remain
  ROUND_END --> GAME_END : intermission elapses, final round
  GAME_END --> LOBBY : host returns everyone to lobby

  note right of DRAWING : PARALLEL_DRAWING state\nalso exists for future\nteam-battle mode
```

### ArenaOrchestrator — Master UI Router

`ArenaOrchestrator` is the single top-level controller that routes the entire application UI based on the FSM game state. It subscribes to 20+ server Socket.IO events and dispatches state updates to the Zustand store.

```mermaid
graph LR
    AO["ArenaOrchestrator (Master Router)"]

    AO -->|"gameState === null"| HS["HomeScreen — create / join room"]
    AO -->|"gameState === LOBBY"| LS["LobbyScreen — settings, players, voice"]
    AO -->|"gameState !== null && !== LOBBY"| AG["Arena Game Grid"]

    AG --> AH["ArenaHUD — round counter, synced timer, word hint"]
    AG --> AL["ArenaLeaderboard — live scores, rank animations"]
    AG --> AC["ArenaCanvas — isolated drawing surface + toolbox"]
    AG --> ACH["ArenaChat — messages, guesses, ghost chat"]
    AG --> VP["VoiceControls — LiveKit mute / deafen / device select"]
    AG --> MAM["MobileActionMenus — radial arc menus (mobile only)"]
    AG --> FE["FloatingEmotes — animated emoji reactions"]

    AG -.->|"overlays"| AW["WordSelectionOverlay — 3 word choices (drawer)"]
    AG -.->|"overlays"| RO["RoundEndOverlay — scores, correct word"]
    AG -.->|"overlays"| GO["GameOverModal — podium, confetti, standings"]
    AG -.->|"overlays"| GA["GameAbortModal — insufficient players"]

    style AO fill:#6366f1,color:#fff
    style AC fill:#10b981,color:#fff
    style AG fill:#1e293b,color:#fff
```

- **Desktop** (`lg:` and above): all three main panels — Leaderboard, Canvas, Chat — render side-by-side in a CSS grid.
- **Mobile**: a single panel is visible at a time. Radial arc action menus are anchored to the bottom corners (left: settings/navigation, right: voice controls).

**ArenaCanvas isolation:** All drawing state — stroke buffer, current path, undo history, flood fill, canvas 2D context — lives entirely inside the `useCanvasDrawing` hook. The `ArenaCanvas` component manages its own tool state (color, size, tool) as local React state, preventing palette changes from triggering re-renders in the orchestrator or sibling components. A standardized `#FAFAF8` paper background ensures consistent artwork contrast across both light and dark application themes.

### Canvas Sync

Rather than emitting a network event on every single pointer-move, the client buffers strokes locally and flushes the buffer to the server on a fixed `setInterval` (`CANVAS_BATCH_INTERVAL_MS = 16`, defined once in `@scribblitz/shared` so client and server always agree on the cadence). The server relays each batch to other players in the room and simultaneously appends it to a Redis Stream (`room:<code>:canvas`, soft-capped at ~5,000 entries with a 2-hour TTL), which is what makes canvas history replay possible for reconnecting or late-joining players.

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
    S->>W: canvas:batch { strokes[] } (immediate relay)
    S->>R: XADD room:<code>:canvas (async persist)
  end

  Note over W: reconnect / late join
  W->>S: canvas:sync_request { roomCode }
  S->>R: XRANGE room:<code>:canvas - +
  R-->>S: full stream history
  S->>W: canvas:history { strokes[] }
```

### Voice Chat Connection Lifecycle

Voice chat is powered by LiveKit. The game server acts only as a **token issuer** — all audio streams flow directly between the browser and the LiveKit server via WebRTC, keeping the game server's event loop free from media processing.

```mermaid
sequenceDiagram
  participant C as Client (Browser)
  participant GS as game-server
  participant LK as LiveKit Server

  Note over C: Player enters lobby or game
  C->>GS: voice:token_request
  GS->>GS: mintVoiceToken(userId, roomCode, username)
  GS->>C: voice:token_issued { token, livekitUrl, roomName }
  C->>LK: room.connect(livekitUrl, token) [WebRTC]
  LK-->>C: Connected — publish microphone track (muted by default)
  Note over C,LK: Low-latency peer audio via WebRTC SFU

  Note over C: Player leaves or game ends
  C->>LK: room.disconnect()
```

1. The client emits `voice:token_request` to the game server.
2. The server generates a LiveKit `AccessToken` (grants: `roomJoin`, `canPublish`, `canSubscribe`; TTL: 10 minutes) and responds with `voice:token_issued { token, livekitUrl, roomName }`.
3. The client connects to the LiveKit room with adaptive streaming, dynacast, echo cancellation, noise suppression, and auto gain control.
4. Players can mute/unmute and deafen/undeafen (deafening automatically mutes the mic). A device selector supports audio input/output switching with Chrome device deduplication.
5. On disconnect or game end, the client disconnects from the LiveKit room.

### AI Word Generation Pipeline

Custom themed word packs are generated off the main game-server thread using a BullMQ job queue and a dedicated worker process.

```mermaid
sequenceDiagram
  participant H as Host (Browser)
  participant GS as game-server
  participant Q as Redis (BullMQ)
  participant W as Worker (Gemini 3.5 Flash)

  H->>GS: theme:generate { theme: "Pirates" }
  GS->>GS: Rate limit check (80s cooldown per room)
  GS->>Q: Add job to ai-theme-queue
  Q->>W: Worker picks up job
  W->>W: Gemini API → 99 words, validate, filter, dedupe
  W->>Q: Return result (≥60 valid words required)
  Q->>GS: Job completed
  GS->>H: room:config_updated + theme:generated_success
```

The worker enforces strict safety: prompt injection sanitization, content safety filters (`BLOCK_LOW_AND_ABOVE`), a hard blocklist for offensive terms, max 20 characters per word, max 2 words per phrase, and a minimum threshold of 60 valid words out of 99 requested.

---

## 🧠 Engineering & Gameplay Spotlights

### ⚡ Real-Time Systems & Resilience

- **Zero-Downtime Reconnects:**
  Player identities are mapped to persistent UUIDs stored in `localStorage`, decoupling gameplay sessions from volatile Socket.IO connection IDs. When a player disconnects, the server starts a 60-second reconnection window (broadcast via `player:disconnected` with `gracePeriodSeconds: 60`) instead of immediately removing them. Upon reconnection, the server performs an `XRANGE` query against the room's Redis Stream, allowing the client to replay the persisted canvas stroke history. If the disconnected player was the active drawer, the round is ended immediately to prevent game stall.

- **16ms Batched Canvas Synchronization:**
  Streaming every `mousemove` event quickly overwhelms the network during rapid drawing. Instead, the client buffers strokes locally and flushes them every 16ms, while the server immediately relays batches to watchers via `socket.to()` and asynchronously persists to Redis Streams. This dual-path architecture optimizes both latency (instant relay) and durability (persistent history).

- **Dynamic Host Migration:**
  If the lobby host disconnects or leaves unexpectedly, the game continues uninterrupted. The server automatically elects a random connected player as the new host and broadcasts a `room:host_changed` event. If remaining connected players fall below `MIN_PLAYERS` (2), the game is aborted with `game:aborted { reason: 'insufficient_players' }`.

- **Single-Session Enforcement:**
  If a player opens a duplicate browser tab, the server detects the duplicate `userId`, sends `SESSION_EXPIRED` to the old socket, and disconnects it — preventing state corruption from concurrent connections.

- **Real-Time Voice Chat (LiveKit):**
  Players can communicate via low-latency WebRTC audio through a LiveKit SFU. The game server issues short-lived JWT access tokens (10-minute TTL) scoped to the room, while all media traffic flows directly between clients and the LiveKit server — keeping the game server's event loop free from audio processing.

### 🛡️ Architecture & Security

- **Contract-Driven Monorepo:**
  Built as a Turborepo, the Next.js client and Express server share a single source of truth through the `@scribblitz/types` workspace. Every Socket.IO event, finite state machine transition, and payload interface is imported from the same package, eliminating API contract drift between frontend and backend.

- **Strict Runtime Validation:**
  Compile-time TypeScript safety alone cannot protect against malformed network requests. Every incoming Socket.IO payload is validated at runtime using Zod schemas (`@scribblitz/validation`) before reaching the core game logic. Invalid or malicious payloads are rejected immediately, ensuring consistent server-side data integrity.

- **Role-Based Guards:**
  Socket handlers enforce strict permission checks — host-only actions (`room:update_config`, `game:start`, `game:return_to_lobby`, `theme:generate`), drawer-only actions (`word:select`, `canvas:batch`, `canvas:clear`, `canvas:undo`), and state-dependent guards (e.g., `game:start` requires `LOBBY` state and no active AI generation).

- **Data Sanitization:**
  Non-host players receive sanitized room configs with `customWordList` stripped and replaced by `customWordCount`. Room serialization scrubs sensitive server-side state: `currentWord`, `wordChoices`, `usedWords`, FSM instance, and all Node.js timer handles.

- **AI Word Generation Off the Hot Path:**
  Custom word requests are published to a BullMQ Redis queue (`ai-theme-queue`) and consumed by a dedicated worker running Google Gemini 3.5 Flash. Results are delivered back via BullMQ job completion, with a 60-second timeout and 80-second per-room rate limit, ensuring the game server's event loop is never blocked by LLM inference.

### 🎮 Premium Gameplay UX

- **VIP Ghost Chat:**
  Once a player correctly guesses the word, their chat experience transitions into an isolated communication channel. The server routes their subsequent messages only to the Drawer and other successful guessers (`isGhost: true`), creating a private conversation without revealing the answer to players who are still guessing.

- **Forgiving Typo Engine:**
  Player guesses are processed through a custom Levenshtein distance algorithm before evaluation. The threshold scales dynamically with word length (1 for short words, higher for longer words). If a guess falls within the threshold, the server suppresses the public chat message and privately emits a `guess:close` event with `"'<guess>' is very close!"`, encouraging the player without leaking information to the rest of the lobby.

- **Progressive Hint System:**
  To maintain engagement throughout each round, the server progressively reveals characters of the target word every `HINT_INTERVAL_SECONDS` (10s). Maximum reveal is capped by difficulty: Easy (50%), Medium (30%), Hard (15%). Hint generation is entirely server-authoritative, ensuring every client receives synchronized updates through `word:hint_updated` events while preventing client-side manipulation.

- **Time-Decay Scoring:**
  Correct guesses award points on a time-decay curve: `⌊100 + 400 × timeRatio⌋`, where `timeRatio` decreases as the round progresses. The active drawer receives a 10% bonus of each guesser's score. This rewards both fast guessing and good drawing.

- **Emote Reactions:**
  Players can send real-time emoji reactions (👍 👎 ❤️ 🔥 😂 😭 🤯) that float as animated overlays across the canvas area using Framer Motion spring physics with randomized horizontal sway and rotation. Rate-limited to 5 emotes per 3-second window per player.

- **Mobile-First Responsive Design:**
  The `ArenaOrchestrator` delivers a fully responsive experience: radial arc action menus anchored on mobile, and a three-column grid layout on desktop. The top header hides on mobile during active gameplay to maximize canvas real estate. Touch targets are sized for mobile interaction with `setPointerCapture` for reliable drawing.

- **Advanced Framer Motion Animations:**
  - **Radial arc action menus**: tool and setting buttons spread using polar coordinate offsets with spring physics.
  - **Frosted-glass overlays**: word selection, round-end, and game-end modals use `backdrop-blur` with semi-transparent backgrounds.
  - **Podium animation**: top 3 players get orchestrated spring-physics podium bars with confetti cannon for the winner.
  - **Leaderboard rank beams**: zero-re-render synchronized metallic gradient sweeps via `useAnimationFrame` mutating a `--beam-progress` CSS custom property.
  - **Theme toggle**: View Transitions API with dynamic radial clip-path origin calculated from pointer coordinates and viewport dimensions.

---

## 💻 Tech Stack

| Technology              | Version                           | Purpose                                                                  |
| ----------------------- | --------------------------------- | ------------------------------------------------------------------------ |
| **TypeScript**          | `5.9`                             | End-to-end type safety and shared monorepo contracts                     |
| **Next.js / React**     | `16.2` / `19.2`                   | Frontend with App Router and React Compiler enabled                      |
| **Tailwind CSS**        | `v4`                              | Utility-first styling with shared config package                         |
| **Framer Motion**       | `12.x`                            | Radial menus, frosted-glass overlays, podium, floating emotes, layout fx |
| **Zustand**             | `5.0`                             | Client-side game state and toast notification management                 |
| **next-themes**         | `0.4`                             | Dark/light theme toggling via class strategy + View Transitions API      |
| **Express + Socket.IO** | `5.x` / `4.8`                     | Real-time game server with rate-limited event handling                   |
| **LiveKit**             | Client `2.13` / Server SDK `2.17` | WebRTC voice chat — token generation and SFU room management             |
| **BullMQ**              | `5.80`                            | Redis-backed job queue for background AI word generation                 |
| **ioredis**             | `5.11`                            | Canvas stream buffering, BullMQ transport, connection state              |
| **Prisma + PostgreSQL** | `7.8` / `16`                      | Persistence layer (User and GameResult models)                           |
| **Google Gemini**       | `gemini-3.5-flash`                | AI-powered themed word list generation via background worker             |
| **Pino + pino-roll**    | `10.3` / `4.0`                    | Structured, rotating production logs (stdout + file)                     |
| **Zod**                 | `3.22+`                           | Runtime payload validation on every socket event                         |
| **canvas-confetti**     | —                                 | Winner celebration and easter egg effects                                |
| **Docker**              | Compose v2                        | Full-stack containerization with health checks and resource limits       |
| **Turborepo & pnpm**    | `2.9` / `11.5`                    | Monorepo build orchestration and workspace management                    |

---

## 📁 Project Structure

```text
scribblitz/
├── apps/
│   ├── web/                     # Next.js frontend
│   │   └── src/
│   │       ├── app/                  # App Router: layout, home, game/[code] route
│   │       ├── components/
│   │       │   ├── Arena/            # ArenaOrchestrator (master router), ArenaCanvas,
│   │       │   │                     # ArenaChat, ArenaLeaderboard, ArenaHUD,
│   │       │   │                     # VoiceControls, MobileActionMenus, EmoteBar,
│   │       │   │                     # FloatingEmotes, WordSelectionOverlay
│   │       │   ├── Home/             # HomeScreen (create / join room, avatar picker)
│   │       │   ├── Lobby/            # LobbyScreen, CustomWordsDrawer,
│   │       │   │                     # StrictModeWarningOverlay
│   │       │   └── ui/               # Button, Modal, Input, ConfirmModal,
│   │       │                         # GameOverModal, RoundEndOverlay,
│   │       │                         # GameAbortModal, RulesModal, ToastManager
│   │       ├── hooks/                # useGameSocket, useCanvasDrawing,
│   │       │                         # useVoiceChat, useSyncedTimer
│   │       ├── store/                # Zustand: gameStore, toastStore
│   │       └── utils/
│   ├── game-server/             # Socket.IO + Express game server
│   │   └── src/
│   │       ├── server.ts             # Entry: auth middleware, connection routing,
│   │       │                         # ghost sweeper, single-session enforcement,
│   │       │                         # 60s disconnect grace, graceful shutdown
│   │       ├── fsm/                  # GameFSM state machine + roundManager
│   │       ├── rooms/                # Room entity, RoomManager singleton
│   │       ├── socket/handlers/      # lobby, game, message, canvas, voice, emote
│   │       ├── socket/utils/         # getSocketByUserId, sanitizeConfig, serializeRoom
│   │       ├── services/             # VoiceService (LiveKit), aiQueue (BullMQ)
│   │       ├── rateLimiters/         # Theme generation rate limiter
│   │       ├── words/                # Default word pool (~4,000 words)
│   │       └── lib/                  # Redis, Prisma, Pino logger
│   └── worker/                  # Background AI word generation service
│       └── src/
│           ├── index.ts              # BullMQ consumer → Gemini 3.5 Flash →
│           │                         # validate, filter, dedupe → return results
│           └── utils/logger.ts       # Pino + pino-roll (daily rotation, 7 files)
├── packages/
│   ├── types/                    # Shared TS types, Socket.IO event constants,
│   │                             # GameState enum, error codes, voice types
│   ├── validation/               # Zod schemas: lobby, game, canvas, chat, emote, theme
│   ├── shared/                   # GAME_CONSTANTS (timers, limits, difficulty, AI config)
│   ├── config/                   # Shared Tailwind CSS config
│   ├── eslint-config/            # Shared ESLint configs (base, next, react-internal)
│   └── typescript-config/        # Shared tsconfig presets (base, nextjs, react-library)
├── prisma/                       # Schema + migrations (User, GameResult models)
├── docker-compose.yml            # Local dev: Postgres + Redis
├── docker-compose.prod.yml       # Production: full stack, resource limits, health checks
└── turbo.json                    # Build/dev/lint pipeline
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

> **Note:** The `.env.example` ships with production-oriented values. For local development, you must update your new `.env` file to point at the Docker containers running on localhost. Match these exact values:

| Variable                      | Local Dev Value                                                                            | Reason                                                                                                            |
| ----------------------------- | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                | `postgresql://scribblitz:scribblitz_dev_secret@localhost:5432/scribblitz_db?schema=public` | Points to the local Docker PostgreSQL instance using the development credentials defined in `docker-compose.yml`. |
| `POSTGRES_PASSWORD`           | `scribblitz_dev_secret`                                                                    | Matches the password configured in `docker-compose.yml`.                                                          |
| `POSTGRES_USER`               | `scribblitz`                                                                               | Matches the PostgreSQL user configured in `docker-compose.yml`.                                                   |
| `REDIS_URL`                   | `redis://localhost:6379`                                                                   | Points to the local Docker Redis instance running without authentication.                                         |
| `REDIS_PASSWORD`              | _(Leave empty or remove)_                                                                  | Development Redis runs without a password.                                                                        |
| `NEXT_PUBLIC_GAME_SERVER_URL` | `http://localhost:3001`                                                                    | Points to the local Express + Socket.IO game server.                                                              |
| `WEB_URL`                     | `http://localhost:3000`                                                                    | Points to the local Next.js frontend application.                                                                 |
| `GEMINI_API_KEY`              | _(Your Google Gemini API key)_                                                             | Required for the AI word generation worker. Get one from [Google AI Studio](https://aistudio.google.com/).        |
| `LIVEKIT_URL`                 | `wss://your-project.livekit.cloud`                                                         | LiveKit server URL. Use [LiveKit Cloud](https://livekit.io/) or self-host.                                        |
| `LIVEKIT_API_KEY`             | _(Your LiveKit API key)_                                                                   | Required for voice chat token generation. Obtain from your LiveKit dashboard.                                     |
| `LIVEKIT_API_SECRET`          | _(Your LiveKit API secret)_                                                                | Required for voice chat token generation. Obtain from your LiveKit dashboard.                                     |

> **Optional services:** Voice chat (`LIVEKIT_*`) and AI word generation (`GEMINI_API_KEY`) are optional. If their environment variables are not set, those features will not affect the core drawing and guessing game it will continue to work without any issues.

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

### 🐳 Production Deployment (Docker)

The full stack can be deployed using Docker Compose. The production configuration includes health checks, resource limits, log volume mounts, and network segmentation (frontend/backend separation).

```bash
# Build and start all services
docker compose -f docker-compose.prod.yml up -d --build

# Or pull pre-built images from Docker Hub (if published)
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

Production services: `web` (port 3000), `game-server` (port 3001), `worker`, `postgres`, `redis`.

---

## 📡 Socket.IO Event Reference

All event names are defined as constants in `@scribblitz/types` (`ClientEvents` / `ServerEvents`) and shared across the monorepo. Every client payload is validated against a Zod schema from `@scribblitz/validation` before reaching business logic.

<details>
<summary><strong>Client → Server Events</strong></summary>

| Event                  | Constant              | Payload                              | Zod Schema                | Description                                                    |
| ---------------------- | --------------------- | ------------------------------------ | ------------------------- | -------------------------------------------------------------- |
| `room:create`          | `ROOM_CREATE`         | `{ username, avatarSeed, config? }`  | `createRoomSchema`        | Create a new room (caller becomes host)                        |
| `room:join`            | `ROOM_JOIN`           | `{ roomCode, username, avatarSeed }` | `joinRoomSchema`          | Join an existing room (lobby state only)                       |
| `room:leave`           | `ROOM_LEAVE`          | _(none)_                             | —                         | Permanently leave the current room                             |
| `room:update_config`   | `ROOM_UPDATE_CONFIG`  | `Partial<RoomConfig>`                | `roomConfigSchema`        | Host updates room settings (host only, lobby only)             |
| `theme:generate`       | `GENERATE_THEME`      | `{ theme }`                          | `generateThemeSchema`     | Host requests AI-generated themed word pack (rate-limited)     |
| `game:start`           | `GAME_START`          | _(none)_                             | —                         | Host starts the game (≥2 players, no active AI generation)     |
| `word:select`          | `WORD_SELECT`         | `{ word }`                           | `wordSelectSchema`        | Drawer picks a word from the 3 choices                         |
| `game:return_to_lobby` | `RETURN_TO_LOBBY`     | _(none)_                             | —                         | Host returns everyone to lobby after game end                  |
| `canvas:batch`         | `CANVAS_BATCH`        | `{ strokes: StrokeEvent[] }`         | `CanvasBatchSchema`       | Buffered stroke batch (max 200 per batch, drawer only)         |
| `canvas:clear`         | `CANVAS_CLEAR`        | _(none)_                             | —                         | Drawer clears the canvas                                       |
| `canvas:undo`          | `CANVAS_UNDO`         | _(none)_                             | —                         | Drawer undoes the last stroke group                            |
| `canvas:sync_request`  | `CANVAS_SYNC_REQUEST` | `{ roomCode }`                       | `CanvasSyncRequestSchema` | Request full canvas history (rate-limited to 1/s)              |
| `chat:message`         | `CHAT_MESSAGE`        | `{ message, roundId }`               | `chatMessageSchema`       | Chat message or guess attempt (stale roundId silently dropped) |
| `emote:send`           | `EMOTE_SEND`          | `{ emoji }`                          | `emoteSchema`             | Send floating emoji reaction (rate-limited: 5 per 3s)          |
| `voice:token_request`  | `VOICE_TOKEN_REQUEST` | _(none)_                             | —                         | Request a LiveKit JWT access token for voice chat              |

</details>

<details>
<summary><strong>Server → Client Events</strong></summary>

| Event                     | Constant                  | Target              | Payload                                                                                        | Description                                               |
| ------------------------- | ------------------------- | ------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| `server:error`            | `ERROR`                   | Requesting socket   | `{ code: ErrorCode, message, isFatal }`                                                        | Standardized error payload                                |
| `room:created`            | `ROOM_CREATED`            | Host socket         | `{ room: SerializedRoom }`                                                                     | Confirms room creation with full room state               |
| `room:joined`             | `ROOM_JOINED`             | Joining socket      | `{ room: SerializedRoom, serverNow? }`                                                         | Confirms join/reconnect with sanitized room state         |
| `player:joined`           | `PLAYER_JOINED`           | Room broadcast      | `{ player: Player }`                                                                           | New player entered or player reconnected                  |
| `player:left`             | `PLAYER_LEFT`             | Room broadcast      | `{ playerId, permanent: true }`                                                                | Player permanently left the room                          |
| `player:disconnected`     | `PLAYER_DISCONNECTED`     | Room broadcast      | `{ playerId, gracePeriodSeconds: 60 }`                                                         | Player disconnected, 60s reconnection window opened       |
| `room:host_changed`       | `HOST_CHANGED`            | Room broadcast      | `{ newHostId }`                                                                                | Host reassigned after disconnect/leave                    |
| `room:config_updated`     | `ROOM_CONFIG_UPDATED`     | Room broadcast      | `{ config: RoomConfig }`                                                                       | Room settings changed (host gets full, others sanitized)  |
| `theme:generated_success` | `THEME_GENERATED_SUCCESS` | Host socket         | `{}`                                                                                           | AI word generation completed successfully                 |
| `game:state_changed`      | `GAME_STATE_CHANGED`      | Room broadcast      | `{ state: GameState }`                                                                         | FSM transition broadcast                                  |
| `round:starting`          | `ROUND_STARTING`          | Room broadcast      | `{ round, totalRounds, drawerId, roundId, timeRemainingMs }`                                   | New round beginning, drawer chosen                        |
| `word:choices`            | `WORD_CHOICES`            | Drawer only         | `{ words: string[] }`                                                                          | 3 word options sent privately to drawer                   |
| `drawer:word_reveal`      | `DRAWER_WORD_REVEAL`      | Drawer only         | `{ word }`                                                                                     | Private reveal of the chosen word to drawer               |
| `round:started`           | `ROUND_STARTED`           | Room broadcast      | `{ drawerId, wordLength, wordHint, timeRemainingMs }`                                          | Drawing phase begins for all players                      |
| `word:hint_updated`       | `WORD_HINT_UPDATED`       | Room broadcast      | `{ hint }`                                                                                     | Progressive hint reveal (every 10s, capped by difficulty) |
| `canvas:batch`            | `CANVAS_BATCH`            | Room (excl. drawer) | `{ strokes: StrokeEvent[] }`                                                                   | Relayed stroke batch to watchers                          |
| `canvas:history`          | `CANVAS_HISTORY`          | Requesting socket   | `{ strokes: StrokeEvent[] }`                                                                   | Full canvas history for sync                              |
| `canvas:cleared`          | `CANVAS_CLEARED`          | Room broadcast      | `{}`                                                                                           | Canvas cleared by drawer                                  |
| `canvas:undone`           | `CANVAS_UNDONE`           | Room broadcast      | `{ strokeId }`                                                                                 | Last stroke group removed (clients remove by strokeId)    |
| `chat:broadcast`          | `CHAT_BROADCAST`          | Room / VIP only     | `{ senderId, senderName, message, isSystem, isGhost? }`                                        | Public chat or VIP ghost chat message                     |
| `player:guessed`          | `PLAYER_GUESSED`          | Room broadcast      | `{ playerId, username }`                                                                       | Public "guessed correctly" notice (word not revealed)     |
| `guess:correct`           | `GUESS_CORRECT`           | Guesser only        | `{ word, pointsEarned }`                                                                       | Private confirmation with word and points earned          |
| `guess:close`             | `GUESS_CLOSE`             | Guesser only        | `{ message }`                                                                                  | Private "you're close!" hint                              |
| `score:update`            | `SCORE_UPDATE`            | Room broadcast      | `{ scores: Array<{ id, score }> }`                                                             | Updated scores after a correct guess                      |
| `round:end`               | `ROUND_END`               | Room broadcast      | `{ correctWord, reason, scores: Array<{id, username, score}>, isFinalRound, timeRemainingMs }` | Round concludes                                           |
| `game:end`                | `GAME_END`                | Room broadcast      | `{ standings: Array<Player & { rank }> }`                                                      | Final ranked standings                                    |
| `game:aborted`            | `GAME_ABORTED`            | Room broadcast      | `{ reason: 'insufficient_players' }`                                                           | Game ended early — not enough players                     |
| `room:lobby_reset`        | `LOBBY_RESET`             | Room broadcast      | `{ room: SerializedRoom }`                                                                     | Everyone returned to lobby (host full, others sanitized)  |
| `emote:broadcast`         | `EMOTE_BROADCAST`         | Room broadcast      | `{ emoji, senderId, startX, id }`                                                              | Floating emoji reaction with random x-position            |
| `voice:token_issued`      | `VOICE_TOKEN_ISSUED`      | Requesting socket   | `{ token, livekitUrl, roomName }`                                                              | LiveKit JWT access token and server URL                   |

</details>

### StrokeEvent Schema

Each stroke in a `canvas:batch` payload has the following structure, validated by `StrokeEventSchema`:

| Field       | Type                                     | Description                                    |
| ----------- | ---------------------------------------- | ---------------------------------------------- |
| `type`      | `'draw' \| 'erase' \| 'fill' \| 'clear'` | Stroke operation type                          |
| `x`         | `number` (-1000–5000)                    | Current X coordinate (logical 800×600 space)   |
| `y`         | `number` (-1000–5000)                    | Current Y coordinate                           |
| `lastX`     | `number` (-1000–5000)                    | Previous X coordinate (for line interpolation) |
| `lastY`     | `number` (-1000–5000)                    | Previous Y coordinate                          |
| `strokeId`  | `string` (max 64)                        | Groups related points for undo                 |
| `color`     | `string` (max 30)                        | Stroke color                                   |
| `brushSize` | `number` (1–100)                         | Brush diameter                                 |
| `sessionId` | `string` (max 16)                        | Drawing session identifier                     |
| `timestamp` | `number`                                 | Client-side timestamp                          |
| `roundId`   | `number`                                 | Round identifier for stale-data filtering      |

---

## 🔮 Roadmap

V2 ships with voice chat, AI word generation, emote reactions, and a fully responsive mobile-first UI. Here's what's next:

1. **User Authentication & Profiles** — wiring up the existing Prisma `User` model with OAuth or magic-link authentication, enabling persistent player profiles, match history (`GameResult`), and lifetime stats.
2. **Team Battle Mode** — the `GameState.PARALLEL_DRAWING` state, `teamId` player field, and `team-battle` room mode are already scaffolded in `@scribblitz/types`, ready for implementation with parallel drawing lanes and team scoring.
3. **Horizontal Scaling with Redis Adapter** — replacing in-memory room state with the Socket.IO Redis adapter to enable multi-instance deployments behind a load balancer.

---

## ⚠️ Known Limitations (v2)

- **In-memory game state** — all active rooms live in the game-server's process memory; a restart clears them. Redis is used for canvas history and BullMQ job queuing, not for cross-instance room state.
- **No authentication** — player identity is a client-generated UUID in `localStorage`. The Prisma `User` and `GameResult` models exist but aren't wired to auth yet.
- **Single-instance architecture** — no horizontal scaling; one Node.js process handles all rooms.

---

## 👨‍💻 Author

Written by **Mirza Mohammad Abbas** — [LinkedIn](https://www.linkedin.com/in/mirza-mohammad-abbas)

## 💡 Inspiration & Acknowledgements

Scribblitz was born out of countless game nights playing [Skribbl.io](https://skribbl.io/) with my friends. While we loved the core drawing and guessing mechanics, we always wished for modern features like seamless built-in voice chat, mobile-first controls, and AI-generated custom word themes.

This project is both a tribute to those game nights and an engineering exercise in modernizing a classic web game into a high-performance, full-stack application.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
