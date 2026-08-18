// ─── Game Logic Tests ─────────────────────────────────────────────────────────
import { describe, it, expect } from "vitest";
import {
  createRoom, getTimeLimit, checkWinner, isValidMove, applyMove,
  switchTurn, legalMoves, resetForRematch, WIN_LINES,
} from "./logic";
import { Cell, GameRoom, Move, Player } from "../../../shared/types";

function p(name: string, pts: number) { return { id: name, name, points: pts }; }

function makeRoom(ov: Partial<GameRoom> = {}): GameRoom {
  return { ...createRoom("classic", p("a", 0), p("b", 0)), moveDeadline: Date.now() + 60_000, ...ov };
}

function board(s: string): Cell[] {
  const c = s.replace(/\|/g, "");
  return [...c].map(ch => ch === "_" ? null : ch as Player);
}

// ── createRoom ────────────────────────────────────────────────────────────────
describe("createRoom", () => {
  it("initializes defaults correctly", () => {
    const r = createRoom("classic", p("a", 10), p("b", 20));
    expect(r.board).toHaveLength(9);
    expect(r.board.every(c => c === null)).toBe(true);
    expect(r.phase).toBe("placement");
    expect(r.turn).toBe("X");
    expect(r.status).toBe("playing");
    expect(r.winner).toBeNull();
    expect(r.placedCount).toEqual({ X: 0, O: 0 });
  });
  it("assigns X and O players", () => {
    const r = createRoom("sudden-death", p("x", 50), p("o", 30));
    expect(r.players.X.name).toBe("x");
    expect(r.players.O.name).toBe("o");
    expect(r.mode).toBe("sudden-death");
  });
});

// ── WIN_LINES ─────────────────────────────────────────────────────────────────
describe("WIN_LINES", () => {
  it("has 8 lines of 3 indices each in [0,8]", () => {
    expect(WIN_LINES).toHaveLength(8);
    WIN_LINES.forEach(l => {
      expect(l).toHaveLength(3);
      l.forEach(i => { expect(i).toBeGreaterThanOrEqual(0); expect(i).toBeLessThanOrEqual(8); });
    });
  });
});

// ── getTimeLimit ──────────────────────────────────────────────────────────────
describe("getTimeLimit", () => {
  it("classic always returns 7", () => {
    [0, 3, 10, 100].forEach(n => expect(getTimeLimit("classic", n)).toBe(7));
  });
  it("sudden-death ramps 7→6→5→4→3", () => {
    expect(getTimeLimit("sudden-death", 0)).toBe(7);
    expect(getTimeLimit("sudden-death", 3)).toBe(6);
    expect(getTimeLimit("sudden-death", 6)).toBe(5);
    expect(getTimeLimit("sudden-death", 9)).toBe(4);
    expect(getTimeLimit("sudden-death", 12)).toBe(3);
  });
  it("sudden-death floors at 3", () => {
    expect(getTimeLimit("sudden-death", 30)).toBe(3);
    expect(getTimeLimit("sudden-death", 999)).toBe(3);
  });
});

// ── checkWinner ───────────────────────────────────────────────────────────────
describe("checkWinner", () => {
  it("returns null for empty board", () => { expect(checkWinner(board("_________"))).toBeNull(); });
  it("returns null for no-win board", () => { expect(checkWinner(board("XOX|OXO|OXO"))).toBeNull(); });
  it("detects X top row", () => { expect(checkWinner(board("XXX|OO_|___"))).toBe("X"); });
  it("detects O middle row", () => { expect(checkWinner(board("XX_|OOO|___"))).toBe("O"); });
  it("detects X bottom row", () => { expect(checkWinner(board("___|OO_|XXX"))).toBe("X"); });
  it("detects X left column", () => { expect(checkWinner(board("XO_|X__|X__"))).toBe("X"); });
  it("detects O center column", () => { expect(checkWinner(board("_O_|XOX|_O_"))).toBe("O"); });
  it("detects X right column", () => { expect(checkWinner(board("__X|O_X|__X"))).toBe("X"); });
  it("detects X main diagonal", () => { expect(checkWinner(board("X__|_X_|__X"))).toBe("X"); });
  it("detects O anti-diagonal", () => { expect(checkWinner(board("__O|_O_|O__"))).toBe("O"); });
});

// ── isValidMove (placement) ───────────────────────────────────────────────────
describe("isValidMove (placement)", () => {
  it("accepts valid placement", () => { expect(isValidMove(makeRoom(), "X", { type: "place", to: 4 })).toBe(true); });
  it("rejects wrong turn", () => { expect(isValidMove(makeRoom(), "O", { type: "place", to: 4 })).toBe(false); });
  it("rejects occupied cell", () => {
    const r = makeRoom(); r.board[4] = "X";
    expect(isValidMove(r, "X", { type: "place", to: 4 })).toBe(false);
  });
  it("rejects if already placed 3", () => {
    const r = makeRoom(); r.placedCount.X = 3;
    expect(isValidMove(r, "X", { type: "place", to: 0 })).toBe(false);
  });
  it("rejects 'move' type in placement", () => { expect(isValidMove(makeRoom(), "X", { type: "move", from: 0, to: 1 })).toBe(false); });
  it("rejects out-of-bounds", () => {
    expect(isValidMove(makeRoom(), "X", { type: "place", to: -1 })).toBe(false);
    expect(isValidMove(makeRoom(), "X", { type: "place", to: 9 })).toBe(false);
  });
  it("rejects when game is over", () => { expect(isValidMove(makeRoom({ status: "over" }), "X", { type: "place", to: 0 })).toBe(false); });
  it("rejects past deadline", () => { expect(isValidMove(makeRoom({ moveDeadline: Date.now() - 1000 }), "X", { type: "place", to: 0 })).toBe(false); });
});

// ── isValidMove (movement) ────────────────────────────────────────────────────
describe("isValidMove (movement)", () => {
  function mvRoom() {
    return makeRoom({ phase: "movement", board: board("XO_|X_O|_X_"), placedCount: { X: 3, O: 3 } });
  }
  it("accepts valid move own→empty", () => { expect(isValidMove(mvRoom(), "X", { type: "move", from: 0, to: 2 })).toBe(true); });
  it("rejects moving opponent's piece", () => { expect(isValidMove(mvRoom(), "X", { type: "move", from: 1, to: 2 })).toBe(false); });
  it("rejects moving to occupied", () => { expect(isValidMove(mvRoom(), "X", { type: "move", from: 0, to: 1 })).toBe(false); });
  it("rejects same from/to", () => { expect(isValidMove(mvRoom(), "X", { type: "move", from: 0, to: 0 })).toBe(false); });
  it("rejects 'place' in movement", () => { expect(isValidMove(mvRoom(), "X", { type: "place", to: 2 })).toBe(false); });
  it("rejects undefined/oob from", () => {
    expect(isValidMove(mvRoom(), "X", { type: "move", to: 2 })).toBe(false);
    expect(isValidMove(mvRoom(), "X", { type: "move", from: -1, to: 2 })).toBe(false);
  });
});

// ── applyMove ─────────────────────────────────────────────────────────────────
describe("applyMove", () => {
  it("places piece and increments counts", () => {
    const r = makeRoom(); applyMove(r, { type: "place", to: 4 });
    expect(r.board[4]).toBe("X"); expect(r.placedCount.X).toBe(1); expect(r.moveCount.X).toBe(1);
  });
  it("transitions to movement after 6 placements", () => {
    const r = makeRoom();
    [0,1,2,3,4,5].forEach((to, i) => { r.turn = i % 2 === 0 ? "X" : "O"; applyMove(r, { type: "place", to }); });
    expect(r.phase).toBe("movement");
  });
  it("moves piece: clears source, fills target", () => {
    const r = makeRoom({ phase: "movement", board: board("X________") });
    applyMove(r, { type: "move", from: 0, to: 8 });
    expect(r.board[0]).toBeNull(); expect(r.board[8]).toBe("X");
  });
  it("clears selected", () => {
    const r = makeRoom(); r.selected = 5; applyMove(r, { type: "place", to: 0 });
    expect(r.selected).toBeNull();
  });
});

// ── switchTurn ─────────────────────────────────────────────────────────────────
describe("switchTurn", () => {
  it("X→O", () => { const r = makeRoom(); switchTurn(r); expect(r.turn).toBe("O"); });
  it("O→X", () => { const r = makeRoom({ turn: "O" }); switchTurn(r); expect(r.turn).toBe("X"); });
});

// ── legalMoves ────────────────────────────────────────────────────────────────
describe("legalMoves", () => {
  it("placement: all empties when < 3 placed", () => {
    const r = makeRoom(); r.board[0] = "X"; r.board[1] = "O"; r.placedCount.X = 1;
    expect(legalMoves(r, "X")).toHaveLength(7);
  });
  it("placement: empty array when 3 already placed", () => {
    const r = makeRoom(); r.placedCount.X = 3;
    expect(legalMoves(r, "X")).toHaveLength(0);
  });
  it("movement: pieces × empties", () => {
    const b: Cell[] = ["X", "O", null, "O", "X", null, null, "X", "O"];
    const r = makeRoom({ phase: "movement", board: b });
    // X at 0,4,7; empties 2,5,6 → 3×3=9
    expect(legalMoves(r, "X")).toHaveLength(9);
  });
  it("movement: 0 moves if no pieces", () => {
    const b: Cell[] = ["O","O","O",null,null,null,null,null,null];
    const r = makeRoom({ phase: "movement", board: b });
    expect(legalMoves(r, "X")).toHaveLength(0);
  });
});

// ── resetForRematch ───────────────────────────────────────────────────────────
describe("resetForRematch", () => {
  it("resets all game state", () => {
    const r = makeRoom({ phase: "movement", turn: "O", status: "over", winner: "X" });
    r.placedCount = { X: 3, O: 2 }; r.rematch = { X: true, O: true };
    resetForRematch(r);
    expect(r.board.every(c => c === null)).toBe(true);
    expect(r.phase).toBe("placement"); expect(r.turn).toBe("X"); expect(r.status).toBe("playing");
    expect(r.winner).toBeNull(); expect(r.rematch).toEqual({ X: false, O: false });
  });
});

// ── Integration: placement → movement transition ─────────────────────────────
describe("Full placement → movement integration", () => {
  it("6 placements → movement phase, then movement works", () => {
    const r = makeRoom();
    [0,1,2,3,4,5].forEach((to, i) => {
      r.turn = i % 2 === 0 ? "X" : "O";
      expect(isValidMove(r, r.turn, { type: "place", to })).toBe(true);
      applyMove(r, { type: "place", to });
    });
    expect(r.phase).toBe("movement");
    r.turn = "X";
    expect(isValidMove(r, "X", { type: "move", from: 0, to: 6 })).toBe(true);
    expect(isValidMove(r, "X", { type: "place", to: 6 })).toBe(false);
  });
});
