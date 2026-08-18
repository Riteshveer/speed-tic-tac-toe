// ─── Socket.IO event handler ──────────────────────────────────────────────────
// Wires all client events to server logic.

import { Server, Socket } from "socket.io";
import { Move, PlayerInfo, Mode, SE } from "../../../shared/types";
import { enqueuePlayer, dequeuePlayer } from "./matchmaking";
import { getRoomForSocket, cleanupSocket } from "./rooms";
import { isValidMove, applyMove, checkWinner, switchTurn } from "../game/logic";
import { startTurnTimer } from "./timer";
import { endGame, requestRematch, handleDisconnect } from "./lifecycle";
import { getLeaderboard } from "../db/supabase";

export function registerSocketHandlers(io: Server, socket: Socket): void {
  // ── queue:join ──────────────────────────────────────────────────────────────
  socket.on(
    SE.QUEUE_JOIN,
    (payload: { player: PlayerInfo; mode: Mode }) => {
      const { player, mode } = payload;
      if (!player?.id || !player?.name || !mode) {
        socket.emit(SE.GAME_ERROR, { message: "Invalid queue payload" });
        return;
      }
      socket.emit(SE.QUEUE_STATUS, { searching: true });
      enqueuePlayer(
        { player, mode, joinedAt: Date.now(), socketId: socket.id },
        io
      );
    }
  );

  // ── move:make ───────────────────────────────────────────────────────────────
  socket.on(SE.MOVE_MAKE, (m: Move) => {
    const ctx = getRoomForSocket(socket.id);
    if (!ctx) {
      socket.emit(SE.GAME_ERROR, { message: "Not in a game" });
      return;
    }
    const { room, role } = ctx;

    if (!isValidMove(room, role, m)) {
      socket.emit(SE.GAME_ERROR, { message: "Invalid move" });
      return;
    }

    // Clear turn timer
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = undefined;
    }

    applyMove(room, m);
    const winner = checkWinner(room.board);

    if (winner) {
      endGame(room, winner, io).catch(console.error);
      return;
    }

    switchTurn(room);
    startTurnTimer(room, io);
  });

  // ── rematch:vote ────────────────────────────────────────────────────────────
  socket.on(SE.REMATCH_VOTE, () => {
    const ctx = getRoomForSocket(socket.id);
    if (!ctx) return;
    requestRematch(ctx.room, ctx.role, io);
  });

  // ── disconnect ──────────────────────────────────────────────────────────────
  socket.on(SE.DISCONNECT, () => {
    dequeuePlayer(socket.id);
    const ctx = getRoomForSocket(socket.id);
    if (ctx) {
      handleDisconnect(ctx.room, ctx.role, io);
    }
    cleanupSocket(socket.id);
  });

  // ── leaderboard request ─────────────────────────────────────────────────────
  socket.on("leaderboard:get", async () => {
    const data = await getLeaderboard(100);
    socket.emit(SE.LEADERBOARD, data);
  });
}
