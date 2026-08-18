# Speed Tic-Tac-Toe — Architecture

> Single source of truth. Keep this file accurate at every commit.

---

## Overview

Real-time multiplayer Speed Tic-Tac-Toe with:
- Server-authoritative timer (7s → 3s ramp in Sudden-Death)
- Skill-based matchmaking (±20 pts, widening) with hidden AI fallback after 90s
- 3 AI difficulty levels (minimax alpha-beta)
- Anonymous Supabase auth + Google OAuth (anonymous→permanent account linking)
- Unique per-account usernames (case-insensitive, server-validated)
- Global leaderboard (top 100, polled every 12s; no Realtime)
- PWA installable frontend

---

## Tech Stack

| Layer | Technology | Hosting | Free Tier Limit |
|-------|-----------|---------|----------------|
| Frontend | React + Vite (TypeScript) | Cloudflare Pages | Unlimited requests |
| Realtime | Node.js + Socket.IO (TypeScript) | Koyeb | 1 instance, 512 MB RAM |
| Database | Supabase Postgres | Supabase | 500 MB DB, 2 GB bandwidth |
| Auth | Supabase Anon Auth + Google OAuth | Supabase | 50,000 MAUs |
| Keep-alive | UptimeRobot (GET /health) | — | 50 monitors, 5-min interval |

---

## File Map

| Path | Purpose |
|------|---------|
| `shared/types.ts` | Shared TypeScript types (Player, GameRoom, Move, SE events, AuthUser, LeaderboardResponse) |
| `server/src/index.ts` | Express + Socket.IO entry; /health, /api/leaderboard?userId=, /api/username/check, /api/username/set |
| `server/src/game/logic.ts` | Pure game functions: createRoom, isValidMove, applyMove, checkWinner |
| `server/src/game/ai.ts` | AI opponent: minimax alpha-beta, 3 difficulty levels, think delay |
| `server/src/socket/handlers.ts` | Socket.IO event dispatcher (queue:join, move:make, rematch:vote) |
| `server/src/socket/matchmaking.ts` | Queue, findMatch, pointsRange, AI fallback |
| `server/src/socket/rooms.ts` | In-memory room registry (rooms, socketToRoom, socketToPlayer maps) |
| `server/src/socket/broadcast.ts` | broadcastState — emits sanitised state per socket (strips isBot) |
| `server/src/socket/timer.ts` | startTurnTimer, handleTimeout, AI move scheduler |
| `server/src/socket/lifecycle.ts` | endGame, requestRematch, resetForRematch, handleDisconnect |
| `server/src/db/supabase.ts` | Supabase helpers: upsertPlayer, awardPoints, checkUsernameAvailable, setUsername, getLeaderboard, getPlayerEntry, getLeaderboardResponse |
| `client/src/App.tsx` | Root app: view router, global socket wiring, header navbar with compact Google auth UI, sound effects |
| `client/src/pages/Lobby.tsx` | Choose mode screen: nickname, mode cards, How to Play, Find Match |
| `client/src/components/PlayTypeSelect.tsx` | Play type selection screen: Play Online vs Play with Friends cards |
| `client/src/pages/Searching.tsx` | Searching screen with elapsed timer |
| `client/src/pages/GamePage.tsx` | Game view: board + timer + end overlay |
| `client/src/pages/Leaderboard.tsx` | Top-100 table, 12s polling, visibility-aware, own-row pinned |
| `client/src/components/Board.tsx` | 3×3 board: click handling, phase logic, win highlight |
| `client/src/components/TimerRing.tsx` | Animated SVG countdown ring synced to server deadline |
| `client/src/components/PlayerBanners.tsx` | Per-player info banners with active-turn highlight |
| `client/src/components/EndScreen.tsx` | Win/loss/draw overlay with rematch voting |
| `client/src/lib/socket.ts` | Socket.IO singleton with auto-reconnect |
| `client/src/lib/auth.ts` | Supabase anon + Google OAuth; anonymous→permanent linking; buildAuthUser; submitUsername |
| `client/src/lib/sounds.ts` | Web Audio API synthesis (place, move, win, lose, timeout, rematch) |
| `client/src/lib/gameUtils.ts` | Client-side getTimeLimit (display only) |
| `client/src/index.css` | Global design system: tokens, layout, all component styles |
| `supabase/migration.sql` | Postgres schema: players table, increment_points RPC |
| `supabase/migration_v2.sql` | v2: unique username index, points index, RLS policies, rank/check RPCs |
| `server/src/game/logic.test.ts` | Tests: createRoom, checkWinner, isValidMove, applyMove, legalMoves, resetForRematch, phase transitions (42 tests) |
| `server/src/game/ai.test.ts` | Tests: pickAiDifficulty, createBotOpponent, humanThinkDelayMs, getAiMove legality (17 tests) |
| `server/src/socket/matchmaking.test.ts` | Tests: pointsRange widening/cap, match criteria, mode filtering, rating proximity (11 tests) |
| `server/src/socket/timer.test.ts` | Tests: getTimeLimit ramp, timeout winner logic, deadline calculation, timer lifecycle (8 tests) |
| `server/src/socket/rooms.test.ts` | Tests: getRoomForSocket, cleanupSocket, cleanupRoom (6 tests) |
| `server/vitest.config.ts` | Vitest configuration with @shared path alias |

---

## Socket Events

| Event | Direction | Payload | Description |
|-------|-----------|---------|-------------|
| `queue:join` | C→S | `{ player: PlayerInfo, mode: Mode }` | Enqueue player, try match, start AI fallback |
| `queue:status` | S→C | `{ searching: boolean }` | Confirm queue entry |
| `move:make` | C→S | `Move` | Validated server-side; rejected silently if invalid |
| `rematch:vote` | C→S | (none) | Vote for rematch; bot auto-accepts |
| `disconnect` | C→S | (built-in) | Dequeue + 15s grace window for reconnect |
| `leaderboard:get` | C→S | (none) | Request leaderboard via socket (fallback) |
| `game:state` | S→C | `GameStatePayload` | Full authoritative state; myRole injected per-socket |
| `game:error` | S→C | `{ message: string }` | Validation or room errors |
| `game:end` | S→C | (via game:state with status=over) | Game over, winner in payload |
| `opponent:disconnected` | S→C | `{ reconnectDeadlineMs: number }` | Notify of opponent disconnect |
| `leaderboard:data` | S→C | `LeaderboardEntry[]` | Leaderboard response via socket |

---

## DB Schema

### `players` table

| Column | Type | Constraints | Notes |
|--------|------|-------------|-------|
| `id` | text | PRIMARY KEY | Supabase auth user UUID (anon or Google) |
| `name` | text | NOT NULL | Display username |
| `points` | integer | NOT NULL, DEFAULT 0 | Atomic increment via `increment_points()` RPC |
| `username_set` | boolean | NOT NULL, DEFAULT false | True once user picked a username after Google login |
| `created_at` | timestamptz | NOT NULL | Auto-set on insert |
| `updated_at` | timestamptz | NOT NULL | Auto-set via trigger |

**Indexes:**
- `players_lower_name_unique` — UNIQUE on `lower(name)` (case-insensitive)
- `players_points_desc_idx` — on `(points DESC, created_at ASC)` for fast leaderboard

### RPCs (all SECURITY DEFINER — run as owner, bypass RLS)

| Function | Args | Returns | Purpose |
|----------|------|---------|--------|
| `increment_points(player_id, delta)` | text, int | void | Atomic upsert + increment; called by service-role only |
| `get_player_rank(player_id)` | text | int | Count of players with more points + 1 |
| `check_username_available(username_candidate)` | text | boolean | Case-insensitive availability check |

### Row Level Security

| Policy | Op | Rule |
|--------|----|------|
| `public_read` | SELECT | `USING (true)` — anyone |
| `own_username_update` | UPDATE | `USING (auth.uid()::text = id)` — owner only |
| Points writes | INSERT/UPDATE points | Only via service-role key (bypasses RLS entirely) |

---

## Game Rules Summary

- Board: 3×3, 9 cells indexed 0–8
- Each player has exactly 3 pieces
- **Placement phase**: first 6 moves total (3 per player); drop on any empty cell
- **Movement phase**: pick up any own piece, move to any empty cell (unrestricted)
- **Win**: any row, col, or diagonal with all 3 pieces
- **Lose by timeout**: timer hits 0 → opponent wins

### Win Lines
`[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]`

---

## Timer Logic

```typescript
function getTimeLimit(mode: Mode, playerMoveCount: number): number {
  if (mode === "classic") return 7;            // flat 7s always
  return Math.max(3, 7 - Math.floor(playerMoveCount / 3));
  // Sudden-Death: 7→6→5→4→3 (floor=3)
}
```

The server sets `moveDeadline = now + timeLimit * 1000` and broadcasts it.
Clients use `requestAnimationFrame` against this epoch for smooth display.

---

## Scoring Policy

| Outcome | Points |
|---------|--------|
| Win – Sudden-Death | +5 |
| Win – Classic | +2 |
| Loss | 0 (no change) |
| Draw | 0 (no change) |
| Win vs AI bot | +pts same as human (illusion preserved) |

Rationale: deducting points on loss creates excessive frustration for casual players. No draws occur in normal play (only by timeout producing a winner).

---

## Matchmaking

1. Queue keyed by `(mode, socketId)`
2. `pointsRange(baseRange=20, waitedMs)` → widens 5 pts per 10s, capped at 150
3. `findMatch()` scans queue for same-mode players within range; picks closest diff
4. After **90 seconds** with no match → `startAiFallback()` creates a hidden bot opponent:
   - Random name from pool, points ≈ player's ± 15
   - `isBot: true` stored server-side only; stripped before broadcast
   - Difficulty: easy (<20 pts), medium (20-60), hard (60+)
   - Human-like think delays applied before every move

---

## AI Difficulty

| Level | Strategy | Think Delay |
|-------|----------|-------------|
| easy | 30% optimal, 70% random | 800–2200ms |
| medium | Minimax depth=3 + 20% noise | 600–2400ms |
| hard | Alpha-beta depth=12 | 400–1600ms |

---

## Env Variables

### Server (`server/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | HTTP port (default: 3001) |
| `CLIENT_ORIGIN` | Yes | Frontend URL for CORS (e.g. `https://yourdomain.pages.dev`) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Service-role key (bypasses RLS for point writes) |

### Client (`client/.env`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SERVER_URL` | Yes | WebSocket server URL |
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Yes | Anon key (read-only operations, auth) |

---

## Edge Cases Handled

| Case | Behavior |
|------|----------|
| Disconnect mid-game | 15s grace window; forfeit if not reconnected |
| Full room (3rd joiner) | Rejected at socket level (rooms store exactly 2 sockets) |
| Simultaneous moves | Server processes by socket event order; first valid wins |
| Invalid move | `game:error` emitted; timer continues; no state change |
| Invalid room | `game:error` with "Not in a game" |
| Timeout | Opponent declared winner; endGame triggers immediately |
| Rematch - one declines/leaves | Other player returned to lobby |
| Bot rematch | Bot auto-accepts; new game starts immediately |

---

## Deploy Checklist

### 1. Supabase
- [ ] Create project at supabase.com
- [ ] Run `supabase/migration.sql` then `supabase/migration_v2.sql` in SQL Editor
- [ ] Enable **Anonymous Auth** (Dashboard → Auth → Providers → Anonymous)
- [ ] Enable **Google OAuth** (Dashboard → Auth → Providers → Google → add OAuth credentials from Google Cloud Console)
- [ ] Add `https://yourdomain.pages.dev` to **Supabase Redirect URLs** (Auth → URL Configuration)
- [ ] Copy Project URL and service-role key

### 2. Koyeb (server)
- [ ] Connect GitHub repo
- [ ] Set build command: `cd server && npm install && npm run build`
- [ ] Set start command: `cd server && node dist/index.js`
- [ ] Add all `server/.env` vars in Koyeb Environment Variables
- [ ] Note the deployed URL (e.g. `https://xxx.koyeb.app`)

### 3. Cloudflare Pages (client)
- [ ] Connect GitHub repo
- [ ] Build command: `cd client && npm install && npm run build`
- [ ] Output directory: `client/dist`
- [ ] Add `VITE_SERVER_URL=https://xxx.koyeb.app` and other vars

### 4. UptimeRobot keep-alive
- [ ] Create HTTP(S) monitor at `https://xxx.koyeb.app/health`
- [ ] Set interval: 10 minutes
- [ ] Free plan: 50 monitors, up to 5-min interval (use 10 min to be safe)

---

## Auth Flow

### Anonymous (default)
1. User opens the app → `buildAuthUser()` calls `supabase.auth.signInAnonymously()`
2. Supabase creates a real but anonymous user; UUID stored in `localStorage`
3. Player picks any display name and plays immediately

### Google OAuth → anonymous linking (points carry over)
1. User clicks **Sign in with Google** in the lobby
2. If currently signed in anonymously: `supabase.auth.linkIdentity({ provider: 'google' })` upgrades the account in-place
3. The `players` row **id stays the same** → all earned points are preserved
4. On first Google login, `username_set = false` → lobby shows the username picker modal
5. User picks a unique username (3–20 chars, letters/numbers/underscores, case-insensitive)
6. Client calls `POST /api/username/set` → server validates + writes to DB

### Username rules
- Length: 3–20 characters
- Characters: `[a-zA-Z0-9_]` only
- Case-insensitive uniqueness enforced at DB level (`UNIQUE INDEX ON lower(name)`)
- Server rejects duplicates with HTTP 409 and a clear message
- Once set for a Google user, the name field is locked in the UI

---

## Leaderboard

- Returns **top 100 rows** ordered by `points DESC, created_at ASC` (stable tie-break)
- **Polling every 12 seconds** (`LEADERBOARD_POLL_MS = 12_000`) — no Realtime subscription
  - **Why polling, not Realtime?** Supabase free tier caps Realtime at ~200 concurrent connections. A leaderboard that sees thousands of casual views would exhaust this limit. Polling is simpler, more scalable, and correct for this use-case.
- Poll **pauses** when `document.visibilityState === 'hidden'` (tab in background)
- Poll **resumes** (with immediate fetch) when tab becomes visible again
- `clearInterval` called on component unmount — zero leak risk
- Manual **Refresh** button calls `fetchLeaderboard()` immediately
- `GET /api/leaderboard?userId=<id>` returns `{ top100: LeaderboardEntry[], myEntry: { rank, name, points } | null }`
  - `myEntry` is computed server-side via counting players with strictly more points + 1
- Client highlights the signed-in user's row in top-100
- If user is **outside** top 100, a pinned row is rendered below the table: `#<rank> — <name> — <points> pts`

---

## Change Log

| Date | Change |
|------|--------|
| 2026-07-20 | Initial build: full game, matchmaking, AI, Supabase anon auth, PWA |
| 2026-07-20 | v2: Google OAuth + anon linking, unique usernames, RLS, top-100 leaderboard with 12s polling, own-rank pin |
| 2026-08-18 | v3: Added Vitest test suite — 84 tests across 5 files (game logic, AI, matchmaking, timer, rooms) |
