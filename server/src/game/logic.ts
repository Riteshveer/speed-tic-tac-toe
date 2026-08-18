// ─── Core Game Logic ──────────────────────────────────────────────────────────
// All game-mutating functions live HERE (server-side only).
// Pure functions where possible; minimax is contained in ai.ts.

import { Cell, GameRoom, Mode, Move, Phase, Player, PlayerInfo } from "../../../shared/types";

// ─── Win Lines ────────────────────────────────────────────────────────────────
export const WIN_LINES: number[][] = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6],             // diagonals
];

// ─── Factory ──────────────────────────────────────────────────────────────────
export function createRoom(
  mode: Mode,
  x: PlayerInfo,
  o: PlayerInfo
): GameRoom {
  return {
    roomId: crypto.randomUUID(),
    mode,
    players: { X: x, O: o },
    board: Array(9).fill(null) as Cell[],
    phase: "placement",
    placedCount: { X: 0, O: 0 },
    moveCount: { X: 0, O: 0 },
    turn: "X",
    selected: null,
    moveDeadline: 0,
    status: "playing",
    winner: null,
    rematch: { X: false, O: false },
  };
}

// ─── Timer Ramp ───────────────────────────────────────────────────────────────
export function getTimeLimit(mode: Mode, playerMoveCount: number): number {
  if (mode === "classic") return 7;
  return Math.max(3, 7 - Math.floor(playerMoveCount / 3));
}

// ─── Win Detection ────────────────────────────────────────────────────────────
export function checkWinner(board: Cell[]): Player | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a] as Player;
    }
  }
  return null;
}

// ─── Move Validation ─────────────────────────────────────────────────────────
export function isValidMove(
  room: GameRoom,
  player: Player,
  m: Move
): boolean {
  if (room.status !== "playing") return false;
  if (room.turn !== player) return false;
  if (Date.now() > room.moveDeadline) return false;

  const { board, phase, placedCount } = room;

  if (m.to < 0 || m.to > 8) return false;
  if (board[m.to] !== null) return false; // target must be empty

  if (phase === "placement") {
    if (m.type !== "place") return false;
    if (placedCount[player] >= 3) return false;
  } else {
    // movement phase
    if (m.type !== "move") return false;
    if (m.from === undefined || m.from < 0 || m.from > 8) return false;
    if (board[m.from] !== player) return false; // must own the piece
    if (m.from === m.to) return false;
  }

  return true;
}

// ─── Apply Move (mutates room) ────────────────────────────────────────────────
export function applyMove(room: GameRoom, m: Move): void {
  const { board, turn } = room;

  if (m.type === "place") {
    board[m.to] = turn;
    room.placedCount[turn]++;
    room.moveCount[turn]++;
    room.selected = null;
    // Transition to movement phase once both players have placed all 3 pieces
    if (room.placedCount.X === 3 && room.placedCount.O === 3) {
      room.phase = "movement";
    }
  } else {
    // type === "move"
    board[m.from!] = null;
    board[m.to] = turn;
    room.moveCount[turn]++;
    room.selected = null;
  }
}

// ─── Turn Switch ──────────────────────────────────────────────────────────────
export function switchTurn(room: GameRoom): void {
  room.turn = room.turn === "X" ? "O" : "X";
}

// ─── Legal Moves (for AI) ─────────────────────────────────────────────────────
export function legalMoves(room: GameRoom, player: Player): Move[] {
  const moves: Move[] = [];
  if (room.phase === "placement") {
    for (let i = 0; i < 9; i++) {
      if (room.board[i] === null && room.placedCount[player] < 3) {
        moves.push({ type: "place", to: i });
      }
    }
  } else {
    const empties = room.board
      .map((c, i) => (c === null ? i : -1))
      .filter((i) => i !== -1);
    for (let i = 0; i < 9; i++) {
      if (room.board[i] === player) {
        for (const to of empties) {
          if (to !== i) moves.push({ type: "move", from: i, to });
        }
      }
    }
  }
  return moves;
}

// ─── Rematch ─────────────────────────────────────────────────────────────────
export function resetForRematch(room: GameRoom): void {
  room.board = Array(9).fill(null) as Cell[];
  room.phase = "placement";
  room.placedCount = { X: 0, O: 0 };
  room.moveCount = { X: 0, O: 0 };
  room.turn = "X";
  room.selected = null;
  room.moveDeadline = 0;
  room.status = "playing";
  room.winner = null;
  room.rematch = { X: false, O: false };
  if (room.timer) {
    clearTimeout(room.timer);
    room.timer = undefined;
  }
}
