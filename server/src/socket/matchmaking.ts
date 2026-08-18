// ─── Matchmaking ──────────────────────────────────────────────────────────────
// Skill-based: match within ±20 pts, widening with wait time.
// Falls back to a hidden AI opponent after 90s.

import { Server } from "socket.io";
import { Mode, PlayerInfo } from "../../../shared/types";
import { createBotOpponent } from "../game/ai";
import { createRoom } from "../game/logic";
import { rooms, socketToRoom, socketToPlayer } from "./rooms";
import { startTurnTimer } from "./timer";
import { broadcastState } from "./broadcast";
import { upsertPlayer } from "../db/supabase";

export interface QueueEntry {
  player: PlayerInfo;
  mode: Mode;
  joinedAt: number;
  socketId: string;
  aiFallbackTimer?: ReturnType<typeof setTimeout>;
}

// Keyed by socketId
const queue = new Map<string, QueueEntry>();

// ─── Points range (widens over time) ─────────────────────────────────────────
export function pointsRange(baseRange: number, waitedMs: number): number {
  // Widen by 5 pts per 10 seconds waited, up to a maximum of 150
  const extra = Math.floor(waitedMs / 10_000) * 5;
  return Math.min(150, baseRange + extra);
}

// ─── Find best match ──────────────────────────────────────────────────────────
export function findMatch(entry: QueueEntry): QueueEntry | null {
  const now = Date.now();
  const range = pointsRange(20, now - entry.joinedAt);
  let best: QueueEntry | null = null;
  let bestDiff = Infinity;

  for (const [sid, candidate] of queue) {
    if (sid === entry.socketId) continue;
    if (candidate.mode !== entry.mode) continue;
    const diff = Math.abs(candidate.player.points - entry.player.points);
    if (diff <= range && diff < bestDiff) {
      bestDiff = diff;
      best = candidate;
    }
  }
  return best;
}

// ─── Enqueue a player ────────────────────────────────────────────────────────
export function enqueuePlayer(entry: QueueEntry, io: Server): void {
  queue.set(entry.socketId, entry);

  // Try immediate match
  const match = findMatch(entry);
  if (match) {
    dequeueAndStart(entry, match, io);
    return;
  }

  // Schedule AI fallback after 90s
  const timer = startAiFallback(entry, io);
  entry.aiFallbackTimer = timer;
}

// ─── Remove from queue (on disconnect / match) ────────────────────────────────
export function dequeuePlayer(socketId: string): void {
  const entry = queue.get(socketId);
  if (entry?.aiFallbackTimer) clearTimeout(entry.aiFallbackTimer);
  queue.delete(socketId);
}

// ─── Start matched game ───────────────────────────────────────────────────────
function dequeueAndStart(
  entryA: QueueEntry,
  entryB: QueueEntry,
  io: Server
): void {
  dequeuePlayer(entryA.socketId);
  dequeuePlayer(entryB.socketId);

  // Randomly assign X/O
  const [xEntry, oEntry] =
    Math.random() < 0.5 ? [entryA, entryB] : [entryB, entryA];

  const room = createRoom(xEntry.mode, xEntry.player, oEntry.player);
  rooms.set(room.roomId, room);
  socketToRoom.set(xEntry.socketId, room.roomId);
  socketToRoom.set(oEntry.socketId, room.roomId);
  socketToPlayer.set(xEntry.socketId, "X");
  socketToPlayer.set(oEntry.socketId, "O");

  // Join Socket.IO rooms
  const xSock = io.sockets.sockets.get(xEntry.socketId);
  const oSock = io.sockets.sockets.get(oEntry.socketId);
  xSock?.join(room.roomId);
  oSock?.join(room.roomId);

  // Persist players (fire-and-forget)
  upsertPlayer(xEntry.player.id, xEntry.player.name).catch(console.error);
  upsertPlayer(oEntry.player.id, oEntry.player.name).catch(console.error);

  broadcastState(room, io, xEntry.socketId, oEntry.socketId);
  startTurnTimer(room, io);
}

// ─── AI Fallback ─────────────────────────────────────────────────────────────
export function startAiFallback(
  entry: QueueEntry,
  io: Server
): ReturnType<typeof setTimeout> {
  return setTimeout(() => {
    if (!queue.has(entry.socketId)) return; // already matched
    dequeuePlayer(entry.socketId);

    const bot = createBotOpponent(entry.player);
    // Randomly assign X/O
    const [xInfo, oInfo] =
      Math.random() < 0.5
        ? [entry.player, bot]
        : [bot, entry.player];

    const room = createRoom(entry.mode, xInfo, oInfo);
    room.players.X.isBot = xInfo.isBot ?? false;
    room.players.O.isBot = oInfo.isBot ?? false;
    rooms.set(room.roomId, room);

    const humanRole = xInfo.id === entry.player.id ? "X" : "O";
    socketToRoom.set(entry.socketId, room.roomId);
    socketToPlayer.set(entry.socketId, humanRole);

    const sock = io.sockets.sockets.get(entry.socketId);
    sock?.join(room.roomId);

    upsertPlayer(entry.player.id, entry.player.name).catch(console.error);

    // Tell the human socket their role (broadcast handles it)
    const botSocketId = ""; // no real socket for the bot
    broadcastState(room, io, 
      humanRole === "X" ? entry.socketId : botSocketId,
      humanRole === "O" ? entry.socketId : botSocketId
    );
    startTurnTimer(room, io);
  }, 90_000);
}
