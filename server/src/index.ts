// ─── Server Entry Point ───────────────────────────────────────────────────────
import "dotenv/config";
import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import { registerSocketHandlers } from "./socket/handlers";
import {
  getLeaderboardResponse,
  checkUsernameAvailable,
  setUsername,
  getDb,
} from "./db/supabase";

const PORT = Number(process.env.PORT ?? 3001);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN ?? "http://localhost:5173";

const app = express();
app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());

// ─── Health (UptimeRobot keep-alive) ──────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ ok: true, ts: Date.now() });
});

// ─── Leaderboard REST: GET /api/leaderboard?userId=xxx ───────────────────────
// Returns { top100, myEntry } — myEntry is null if userId not provided.
// Clients POLL this every 12 s; no Realtime subscription needed.
app.get("/api/leaderboard", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || undefined;
    const data = await getLeaderboardResponse(userId);
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: "Leaderboard unavailable" });
  }
});

// ─── Username REST endpoints ──────────────────────────────────────────────────

// GET /api/username/check?name=xxx → { available: boolean }
app.get("/api/username/check", async (req, res) => {
  const name = (req.query.name as string) ?? "";
  const trimmed = name.trim();
  if (!trimmed) { res.json({ available: false }); return; }
  try {
    const available = await checkUsernameAvailable(trimmed);
    res.json({ available });
  } catch {
    res.status(500).json({ available: false });
  }
});

// POST /api/username/set  { userId, username }
// Called by the client after Google login to save the chosen username.
// Validates + enforces uniqueness server-side.
app.post("/api/username/set", async (req, res) => {
  const { userId, username } = req.body as { userId?: string; username?: string };
  if (!userId || !username) {
    res.status(400).json({ ok: false, error: "Missing userId or username" });
    return;
  }

  // Verify JWT identity if DB/Supabase is enabled
  const db = getDb();
  if (db) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ ok: false, error: "Unauthorized: Missing token" });
      return;
    }
    const token = authHeader.substring(7);
    const { data: { user }, error } = await db.auth.getUser(token);
    if (error || !user || user.id !== userId) {
      res.status(401).json({ ok: false, error: "Unauthorized: Invalid token" });
      return;
    }
  }

  const result = await setUsername(userId, username);
  if (result.ok) {
    res.json({ ok: true });
  } else {
    res.status(409).json({ ok: false, error: result.error });
  }
});

// ─── Socket.IO ────────────────────────────────────────────────────────────────
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, methods: ["GET", "POST"] },
  pingTimeout: 30_000,
  pingInterval: 10_000,
});

io.on("connection", (socket) => {
  console.log(`[socket] connected: ${socket.id}`);
  registerSocketHandlers(io, socket);
});

httpServer.listen(PORT, () => {
  console.log(`🚀 Speed Tic-Tac-Toe server running on port ${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
});

export { io };
