// ─── Game lifecycle: endGame, rematch, disconnect ──────────────────────────────

import { Server } from "socket.io";
import { GameRoom, Player, SE } from "../../../shared/types";
import { awardPoints } from "../db/supabase";
import { resetForRematch } from "../game/logic";
import { broadcastStateToRoom, findSocketForRole } from "./broadcast";
import { cleanupSocket, rooms, socketToRoom, socketToPlayer } from "./rooms";
import { startTurnTimer } from "./timer";

// ─── End game ─────────────────────────────────────────────────────────────────
export async function endGame(
  room: GameRoom,
  winner: Player | null,
  io: Server
): Promise<void> {
  if (room.status === "over") return; // guard double-calls
  room.status = "over";
  room.winner = winner;
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }

  // Award points to winner (bot winners don't get real points; human winners do)
  if (winner) {
    const winnerInfo = room.players[winner];
    // Award if it's a real player (isBot=false/undefined)
    if (!winnerInfo.isBot) {
      await awardPoints(winnerInfo.id, room.mode);
    }
  }

  broadcastStateToRoom(room, io);

  // Auto-accept rematch for bot side
  const xIsBot = room.players.X.isBot ?? false;
  const oIsBot = room.players.O.isBot ?? false;
  if (xIsBot) room.rematch.X = true;
  if (oIsBot) room.rematch.O = true;
}

// ─── Rematch flow ─────────────────────────────────────────────────────────────
export function requestRematch(
  room: GameRoom,
  player: Player,
  io: Server
): void {
  room.rematch[player] = true;

  // Auto-accept for bot opponent
  const opponent: Player = player === "X" ? "O" : "X";
  if (room.players[opponent].isBot) room.rematch[opponent] = true;

  broadcastStateToRoom(room, io);

  if (room.rematch.X && room.rematch.O) {
    resetForRematch(room);
    broadcastStateToRoom(room, io);
    startTurnTimer(room, io);
  }
}

// ─── Disconnect handling ──────────────────────────────────────────────────────
export function handleDisconnect(
  room: GameRoom,
  player: Player,
  io: Server
): void {
  if (room.status === "over") return;

  // Give a 15-second grace window for reconnect
  const reconnectDeadline = Date.now() + 15_000;

  // Pause the turn timer briefly
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }

  // Notify opponent
  const opponent: Player = player === "X" ? "O" : "X";
  const oppSocket = findSocketForRole(room.roomId, opponent);
  if (oppSocket) {
    io.sockets.sockets.get(oppSocket)?.emit(SE.OPPONENT_DISCONNECTED, {
      reconnectDeadlineMs: reconnectDeadline,
    });
  }

  // If not reconnected in time, forfeit
  setTimeout(async () => {
    if (room.status === "over") return;
    // If the player reconnected (their socket is in the room again), abort
    const reconSocket = findSocketForRole(room.roomId, player);
    if (reconSocket) return; // reconnected; already handled

    await endGame(room, opponent, io);
  }, 15_000);
}
