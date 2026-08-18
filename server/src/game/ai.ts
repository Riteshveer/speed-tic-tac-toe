// ─── AI Opponent ──────────────────────────────────────────────────────────────
// Server-side only. Never reveal difficulty or "bot" status to clients.

import { Cell, GameRoom, Move, Player, PlayerInfo } from "../../../shared/types";
import {
  applyMove,
  checkWinner,
  legalMoves,
  switchTurn,
  WIN_LINES,
} from "./logic";

// ─── Human-like name pool ─────────────────────────────────────────────────────
const NAME_POOL = [
  "Kai_77", "Mira.X", "blaze99", "TacticalT", "nova_moon",
  "Zephyr21", "pixelwolf", "SkyRider", "ghost_fox", "LunaPlay",
  "echo_rush", "storm_kai", "riven_arc", "flux99", "dusk_wave",
  "neon_vex", "swift_val", "iron_leaf", "zenfire", "coda_prime",
];

// ─── Difficulty selection ─────────────────────────────────────────────────────
export function pickAiDifficulty(
  playerPoints: number
): "easy" | "medium" | "hard" {
  if (playerPoints < 20) return "easy";
  if (playerPoints < 60) return "medium";
  return "hard";
}

// ─── Bot player factory ───────────────────────────────────────────────────────
export function createBotOpponent(near: PlayerInfo): PlayerInfo {
  const name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)];
  const pointsVariance = Math.floor((Math.random() - 0.5) * 30);
  const points = Math.max(0, near.points + pointsVariance);
  return {
    id: `bot_${crypto.randomUUID()}`,
    name,
    points,
    isBot: true,
    botLevel: pickAiDifficulty(near.points),
  };
}

// ─── Think delay (feels human) ────────────────────────────────────────────────
export function humanThinkDelayMs(
  level: string,
  timeLimit: number
): number {
  const maxDelay = (timeLimit - 1) * 1000;
  switch (level) {
    case "easy":
      return Math.min(maxDelay, 800 + Math.random() * 1400);
    case "medium":
      return Math.min(maxDelay, 600 + Math.random() * 1800);
    case "hard":
      return Math.min(maxDelay, 400 + Math.random() * 1200);
    default:
      return Math.min(maxDelay, 800 + Math.random() * 1200);
  }
}

// ─── Get AI move ──────────────────────────────────────────────────────────────
export function getAiMove(
  room: GameRoom,
  me: Player,
  level: "easy" | "medium" | "hard"
): Move {
  const moves = legalMoves(room, me);
  if (moves.length === 0) throw new Error("AI has no legal moves");

  if (level === "easy") return easyMove(room, me, moves);
  if (level === "medium") return mediumMove(room, me, moves);
  return hardMove(room, me, moves);
}

// ─── Easy: mostly random ──────────────────────────────────────────────────────
function easyMove(room: GameRoom, me: Player, moves: Move[]): Move {
  // 30% chance to play optimal anyway (avoidable blunder)
  if (Math.random() < 0.3) return hardMove(room, me, moves);
  return moves[Math.floor(Math.random() * moves.length)];
}

// ─── Medium: shallow minimax + noise ─────────────────────────────────────────
function mediumMove(room: GameRoom, me: Player, moves: Move[]): Move {
  // 20% random noise
  if (Math.random() < 0.2) return moves[Math.floor(Math.random() * moves.length)];
  return bestMoveByMinimax(room, me, 3);
}

// ─── Hard: full alpha-beta ────────────────────────────────────────────────────
function hardMove(room: GameRoom, me: Player, moves: Move[]): Move {
  return bestMoveByMinimax(room, me, 12);
}

function bestMoveByMinimax(
  room: GameRoom,
  me: Player,
  maxDepth: number
): Move {
  const moves = legalMoves(room, me);
  let bestScore = -Infinity;
  let bestMove = moves[0];

  for (const m of moves) {
    const clone = cloneRoom(room);
    applyMove(clone, m);
    const winner = checkWinner(clone.board);
    if (winner === me) return m; // immediate win
    switchTurn(clone);
    const score = minimax(clone, me, maxDepth - 1, -Infinity, Infinity, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = m;
    }
  }
  return bestMove;
}

// ─── Minimax ──────────────────────────────────────────────────────────────────
export function minimax(
  room: GameRoom,
  me: Player,
  depth: number,
  alpha: number,
  beta: number,
  isMaximizing: boolean
): number {
  const winner = checkWinner(room.board);
  if (winner === me) return 100 + depth;
  if (winner !== null) return -(100 + depth);
  if (depth === 0) return evaluate(room.board, me);

  const current = isMaximizing ? me : opponent(me);
  const moves = legalMoves(room, current);
  if (moves.length === 0) return 0;

  if (isMaximizing) {
    let best = -Infinity;
    for (const m of moves) {
      const clone = cloneRoom(room);
      applyMove(clone, m);
      if (checkWinner(clone.board) === null) switchTurn(clone);
      const score = minimax(clone, me, depth - 1, alpha, beta, false);
      best = Math.max(best, score);
      alpha = Math.max(alpha, best);
      if (beta <= alpha) break;
    }
    return best;
  } else {
    let best = Infinity;
    for (const m of moves) {
      const clone = cloneRoom(room);
      applyMove(clone, m);
      if (checkWinner(clone.board) === null) switchTurn(clone);
      const score = minimax(clone, me, depth - 1, alpha, beta, true);
      best = Math.min(best, score);
      beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }
}

// ─── Heuristic evaluator ──────────────────────────────────────────────────────
function evaluate(board: Cell[], me: Player): number {
  const opp = opponent(me);
  let score = 0;
  for (const [a, b, c] of WIN_LINES) {
    const line = [board[a], board[b], board[c]];
    const mine = line.filter((x) => x === me).length;
    const theirs = line.filter((x) => x === opp).length;
    if (theirs === 0) score += mine === 2 ? 5 : mine === 1 ? 1 : 0;
    if (mine === 0) score -= theirs === 2 ? 5 : theirs === 1 ? 1 : 0;
  }
  return score;
}

function opponent(p: Player): Player {
  return p === "X" ? "O" : "X";
}

// ─── Lightweight room clone for minimax ───────────────────────────────────────
function cloneRoom(room: GameRoom): GameRoom {
  return {
    ...room,
    board: [...room.board] as Cell[],
    placedCount: { ...room.placedCount },
    moveCount: { ...room.moveCount },
    rematch: { ...room.rematch },
    timer: undefined, // don't copy live timer handle
  };
}
