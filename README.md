# Speed Tic-Tac-Toe

Real-time multiplayer Speed Tic-Tac-Toe with shrinking timers, skill-based matchmaking, hidden AI opponents, and a global leaderboard. **100% free tier** — no paid services.

## Quick Start (Local)

### Prerequisites
- Node.js v18+
- npm v9+

### 1. Clone & install

```bash
# Server
cd server
npm install

# Client
cd ../client
npm install
```

### 2. Configure environment

**Server** — copy and fill in:
```bash
cp server/.env.example server/.env
```

**Client** — copy and fill in:
```bash
cp client/.env.example client/.env.local
```

> For local dev without Supabase, the app works in degraded mode (no points persistence, no leaderboard). The game itself is fully functional.

### 3. Run

Open two terminals:

```bash
# Terminal 1 – Server (hot reload)
cd server
npm run dev

# Terminal 2 – Client (Vite dev server)
cd client
npm run dev
```

Open `http://localhost:5173` in two browser windows to test multiplayer.

---

## Supabase Setup

1. Create a free project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → **New query**
3. Paste and run `supabase/migration.sql`
4. Enable **Anonymous Sign-in**: Dashboard → Auth → Sign In Methods → Anonymous
5. Copy your Project URL and keys into `.env` files

---

## Deployment

### Server → Koyeb (free)

1. Push repo to GitHub
2. Create a [Koyeb](https://koyeb.com) account (free, no credit card)
3. New Service → GitHub → select repo
4. Build command: `cd server && npm install && npm run build`
5. Run command: `cd server && node dist/index.js`
6. Add environment variables (from `server/.env.example`)
7. Note the service URL (e.g. `https://xxx.koyeb.app`)

### Client → Cloudflare Pages (free)

1. [Cloudflare Pages](https://pages.cloudflare.com) → Connect to Git
2. Build command: `cd client && npm install && npm run build`
3. Build output: `client/dist`
4. Environment variables:
   ```
   VITE_SERVER_URL=https://xxx.koyeb.app
   VITE_SUPABASE_URL=https://xxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJxxx...
   ```

### Keep-alive → UptimeRobot (free)

1. Create account at [uptimerobot.com](https://uptimerobot.com)
2. Add HTTP monitor: `https://xxx.koyeb.app/health`
3. Interval: **10 minutes** (free plan allows 5-min minimum; 10-min is safe)
4. This prevents the Koyeb instance from sleeping between games

---

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the complete architecture, socket event table, DB schema, scoring policy, AI difficulty levels, and change log.

---

## Game Modes

| Mode | Timer | Win Points |
|------|-------|-----------|
| Classic | Flat 7s | +2 |
| Sudden Death 🔥 | 7→6→5→4→3s | +5 |

## Free Tier Limits

| Service | Limit |
|---------|-------|
| Koyeb | 1 instance, 512 MB RAM, stays running (no sleep) |
| Cloudflare Pages | Unlimited requests, 500 builds/month |
| Supabase | 500 MB DB, 50K MAUs, 2 GB bandwidth/month |
| UptimeRobot | 50 monitors, 5-min minimum interval |
