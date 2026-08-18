// ─── Server-authoritative timer ───────────────────────────────────────────────

import { Server } from "socket.io";
import { GameRoom, Player } from "../../../shared/types";
import {
  applyMove,
  checkWinner,
  getTimeLimit,
  switchTurn,
} from "../game/logic";
import { broadcastStateToRoom } from "./broadcast";
import { endGame } from "./lifecycle";
import { getAiMove, humanThinkDelayMs } from "../game/ai";

export function startTurnTimer(room: GameRoom, io: Server): void {
  // Clear any existing timer first
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }

  const timeLimit = getTimeLimit(room.mode, room.moveCount[room.turn]);
  room.moveDeadline = Date.now() + timeLimit * 1000;

  // Broadcast updated state with new deadline
  broadcastStateToRoom(room, io);

  room.timer = setTimeout(() => handleTimeout(room, io), timeLimit * 1000);

  // If current player is a bot, schedule its move
  scheduleAiMoveIfNeeded(room, io, timeLimit);
}

export function handleTimeout(room: GameRoom, io: Server): void {
  if (room.status !== "playing") return;
  // The player whose turn it is loses by timeout
  const loser = room.turn;
  const winner: Player = loser === "X" ? "O" : "X";
  endGame(room, winner, io).catch(console.error);
}

// ─── AI move scheduler ────────────────────────────────────────────────────────
function scheduleAiMoveIfNeeded(
  room: GameRoom,
  io: Server,
  timeLimit: number
): void {
  const currentPlayerInfo = room.players[room.turn];
  if (!currentPlayerInfo.isBot) return;

  const level = currentPlayerInfo.botLevel ?? "medium";
  const delay = humanThinkDelayMs(level, timeLimit);

  // Capture turn snapshot to guard stale callbacks
  const expectedTurn = room.turn;

  setTimeout(() => {
    if (room.status !== "playing") return;
    if (room.turn !== expectedTurn) return; // turn already switched
    if (!room.players[room.turn].isBot) return;

    try {
      const move = getAiMove(room, room.turn, level);

      // Clear the turn timer before applying
      if (room.timer) {
        clearTimeout(room.timer);
        room.timer = undefined;
      }

      applyMove(room, move);
      const winner = checkWinner(room.board);
      if (winner) {
        endGame(room, winner, io).catch(console.error);
        return;
      }
      switchTurn(room);
      startTurnTimer(room, io);
    } catch (e) {
      console.error("[ai] move error:", e);
    }
  }, delay);
}
