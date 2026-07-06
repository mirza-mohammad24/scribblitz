# Graph Report - scribblitz (2026-07-06)

## Corpus Check

- 112 files · ~44,769 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary

- 557 nodes · 705 edges · 45 communities (36 shown, 9 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 4 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness

- Built from commit: `72d5f374`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)

- [[_COMMUNITY_Community 0|Community 0]]
- [[_COMMUNITY_Community 1|Community 1]]
- [[_COMMUNITY_Community 2|Community 2]]
- [[_COMMUNITY_Community 3|Community 3]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_Community 6|Community 6]]
- [[_COMMUNITY_Community 7|Community 7]]
- [[_COMMUNITY_Community 8|Community 8]]
- [[_COMMUNITY_Community 10|Community 10]]
- [[_COMMUNITY_Community 11|Community 11]]
- [[_COMMUNITY_Community 12|Community 12]]
- [[_COMMUNITY_Community 13|Community 13]]
- [[_COMMUNITY_Community 14|Community 14]]
- [[_COMMUNITY_Community 15|Community 15]]
- [[_COMMUNITY_Community 16|Community 16]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Community 18|Community 18]]
- [[_COMMUNITY_Community 19|Community 19]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_Community 22|Community 22]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_Community 24|Community 24]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 32|Community 32]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 45|Community 45]]

## God Nodes (most connected - your core abstractions)

1. `compilerOptions` - 16 edges
2. `Room` - 15 edges
3. `RoomManager` - 15 edges
4. `compilerOptions` - 15 edges
5. `useGameStore` - 14 edges
6. `GameFSM` - 10 edges
7. `startNextRound()` - 9 edges
8. `clearTimer()` - 9 edges
9. `useGameSocket()` - 8 edges
10. `getWordPoolWithCustomPriority()` - 7 edges

## Surprising Connections (you probably didn't know these)

- `PNPM Workspace Configuration` --references--> `docs (Next.js app)` [INFERRED]
  pnpm-workspace.yaml → README.md
- `PNPM Workspace Configuration` --references--> `web (Next.js app)` [INFERRED]
  pnpm-workspace.yaml → README.md
- `@turbo/eslint-config README` --references--> `@repo/eslint-config` [EXTRACTED]
  packages/eslint-config/README.md → README.md
- `HUDTimer()` --calls--> `useSyncedTimer()` [EXTRACTED]
  apps/web/src/components/Arena/ArenaHUD.tsx → apps/web/src/hooks/useSyncedTimer.ts
- `Footer()` --calls--> `useGameStore` [EXTRACTED]
  apps/web/src/components/Footer.tsx → apps/web/src/store/gameStore.ts

## Import Cycles

- None detected.

## Communities (45 total, 9 thin omitted)

### Community 0 - "Community 0"

Cohesion: 0.08
Nodes (38): endGame(), endRound(), selectWord(), startGame(), startNextRound(), registerCanvasHandlers(), syncRateLimitMap, handleGameStart() (+30 more)

### Community 1 - "Community 1"

Cohesion: 0.08
Nodes (35): ArenaCanvas(), ArenaCanvasProps, BRUSH_SIZES, PRESET_COLORS, ArenaChat(), ArenaHUD(), ArenaHUDProps, HUDTimer() (+27 more)

### Community 2 - "Community 2"

Cohesion: 0.06
Nodes (32): author, dependencies, cors, dotenv, express, ioredis, nanoid, @scribblitz/shared (+24 more)

### Community 3 - "Community 3"

Cohesion: 0.08
Nodes (24): husky.sh script, devDependencies, dotenv, husky, lint-staged, prettier, prisma, turbo (+16 more)

### Community 4 - "Community 4"

Cohesion: 0.08
Nodes (23): dependencies, canvas-confetti, framer-motion, lucide-react, next, next-themes, react, react-dom (+15 more)

### Community 5 - "Community 5"

Cohesion: 0.09
Nodes (21): author, dependencies, dotenv, ioredis, @scribblitz/shared, description, devDependencies, tsx (+13 more)

### Community 6 - "Community 6"

Cohesion: 0.10
Nodes (20): devDependencies, eslint, eslint-config-prettier, @eslint/js, eslint-plugin-only-warn, eslint-plugin-react, eslint-plugin-react-hooks, eslint-plugin-turbo (+12 more)

### Community 7 - "Community 7"

Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+11 more)

### Community 8 - "Community 8"

Cohesion: 0.11
Nodes (18): dependencies, pg, @prisma/adapter-pg, @prisma/client, engines, node, lint-staged, \*.{ts,tsx,js,jsx,json,md} (+10 more)

### Community 10 - "Community 10"

Cohesion: 0.12
Nodes (16): compilerOptions, declaration, declarationMap, esModuleInterop, incremental, isolatedModules, lib, module (+8 more)

### Community 11 - "Community 11"

Cohesion: 0.13
Nodes (14): config, nextJsConfig, config, devDependencies, babel-plugin-react-compiler, eslint, eslint-config-next, tailwindcss (+6 more)

### Community 12 - "Community 12"

Cohesion: 0.15
Nodes (12): dependencies, @scribblitz/shared, zod, devDependencies, typescript, main, name, scripts (+4 more)

### Community 13 - "Community 13"

Cohesion: 0.24
Nodes (3): GameFSM, LEGAL_TRANSITIONS, TransitionMap

### Community 14 - "Community 14"

Cohesion: 0.13
Nodes (3): Room, RoomManager, mockConfig

### Community 15 - "Community 15"

Cohesion: 0.20
Nodes (9): CanvasBatchSchema, CanvasSyncRequestSchema, ChatMessagePayload, chatMessageSchema, HistoryPayloadSchema, StrokeEventSchema, ValidatedCanvasBatch, WordSelectPayload (+1 more)

### Community 16 - "Community 16"

Cohesion: 0.20
Nodes (9): devDependencies, typescript, main, name, scripts, build, dev, types (+1 more)

### Community 17 - "Community 17"

Cohesion: 0.20
Nodes (9): devDependencies, typescript, main, name, scripts, build, dev, types (+1 more)

### Community 18 - "Community 18"

Cohesion: 0.20
Nodes (9): compilerOptions, allowJs, jsx, module, moduleResolution, noEmit, plugins, extends (+1 more)

### Community 19 - "Community 19"

Cohesion: 0.25
Nodes (6): fredoka, geistMono, geistSans, metadata, viewport, ThemeProvider()

### Community 20 - "Community 20"

Cohesion: 0.22
Nodes (8): compilerOptions, declaration, declarationMap, outDir, rootDir, sourceMap, extends, include

### Community 21 - "Community 21"

Cohesion: 0.22
Nodes (8): compilerOptions, declaration, declarationMap, outDir, rootDir, sourceMap, extends, include

### Community 22 - "Community 22"

Cohesion: 0.22
Nodes (8): compilerOptions, declaration, declarationMap, outDir, rootDir, sourceMap, extends, include

### Community 23 - "Community 23"

Cohesion: 0.32
Nodes (8): @turbo/eslint-config README, PNPM Workspace Configuration, docs (Next.js app), @repo/eslint-config, Turborepo Starter, @repo/typescript-config, @repo/ui, web (Next.js app)

### Community 24 - "Community 24"

Cohesion: 0.29
Nodes (4): ErrorCode, GameError, ClientEvents, ServerEvents

### Community 25 - "Community 25"

Cohesion: 0.29
Nodes (5): createRoomSchema, joinRoomSchema, roomCodeSchema, roomConfigSchema, usernameSchema

### Community 26 - "Community 26"

Cohesion: 0.29
Nodes (4): hostId, p1Socket, p2Socket, player2Id

### Community 27 - "Community 27"

Cohesion: 0.29
Nodes (6): license, name, private, publishConfig, access, version

### Community 28 - "Community 28"

Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 29 - "Community 29"

Cohesion: 0.33
Nodes (5): GameState, Player, RoomConfig, RoomState, StrokeEvent

### Community 30 - "Community 30"

Cohesion: 0.33
Nodes (5): compilerOptions, outDir, rootDir, extends, include

### Community 31 - "Community 31"

Cohesion: 0.40
Nodes (4): compilerOptions, jsx, extends, $schema

### Community 44 - "Community 44"

Cohesion: 0.08
Nodes (18): Footer(), ThemeToggle(), HomeScreen(), HomeScreenProps, ANIMATION_CONFIG, LogoItem, LogoLoop, LogoLoopProps (+10 more)

### Community 45 - "Community 45"

Cohesion: 0.22
Nodes (8): CustomWordsDrawer(), CustomWordsDrawerProps, itemVariants, listVariants, LobbyScreen(), LobbyScreenProps, StrictModeWarningOverlay(), StrictModeWarningOverlayProps

## Knowledge Gaps

- **314 isolated node(s):** `DEFAULT_WORDS`, `ArenaHUDProps`, `PlayerStanding`, `GameOverModalProps`, `containerVariants` (+309 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions

_Questions this graph is uniquely positioned to answer:_

- **Why does `io` connect `Community 1` to `Community 0`?**
  _High betweenness centrality (0.056) - this node is a cross-community bridge._
- **Why does `Room` connect `Community 14` to `Community 0`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **What connects `DEFAULT_WORDS`, `ArenaHUDProps`, `PlayerStanding` to the rest of the system?**
  _314 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Community 0` be split into smaller, more focused modules?**
  _Cohesion score 0.08305084745762711 - nodes in this community are weakly interconnected._
- **Should `Community 1` be split into smaller, more focused modules?**
  _Cohesion score 0.07607843137254902 - nodes in this community are weakly interconnected._
- **Should `Community 2` be split into smaller, more focused modules?**
  _Cohesion score 0.06060606060606061 - nodes in this community are weakly interconnected._
- **Should `Community 3` be split into smaller, more focused modules?**
  _Cohesion score 0.07692307692307693 - nodes in this community are weakly interconnected._
