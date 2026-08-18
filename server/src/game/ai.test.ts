// ─── AI Tests ─────────────────────────────────────────────────────────────────
// "hard" uses depth-12 minimax — too slow for tests.
// "easy" internally calls hardMove 30% of the time — also risky.
// We only test "medium" (depth-3) for general scenarios.
// We verify "hard" logic only via pickAiDifficulty + factory tests.

import { describe, it, expect } from "vitest";
import { pickAiDifficulty, createBotOpponent, humanThinkDelayMs, getAiMove } from "./ai";
import { createRoom, legalMoves } from "./logic";
import { Cell, GameRoom, PlayerInfo } from "../../../shared/types";

function p(name: string, pts: number): PlayerInfo {
  return { id: name, name, points: pts };
}

function makeRoom(ov: Partial<GameRoom> = {}): GameRoom {
  return {
    ...createRoom("classic", p("a", 0), p("b", 0)),
    moveDeadline: Date.now() + 60_000,
    ...ov,
  };
}

// ── pickAiDifficulty ──────────────────────────────────────────────────────────
describe("pickAiDifficulty", () => {
  it("easy for < 20 points", () => {
    expect(pickAiDifficulty(0)).toBe("easy");
    expect(pickAiDifficulty(10)).toBe("easy");
    expect(pickAiDifficulty(19)).toBe("easy");
  });
  it("medium for 20–59 points", () => {
    expect(pickAiDifficulty(20)).toBe("medium");
    expect(pickAiDifficulty(40)).toBe("medium");
    expect(pickAiDifficulty(59)).toBe("medium");
  });
  it("hard for 60+ points", () => {
    expect(pickAiDifficulty(60)).toBe("hard");
    expect(pickAiDifficulty(100)).toBe("hard");
    expect(pickAiDifficulty(999)).toBe("hard");
  });
});

// ── createBotOpponent ─────────────────────────────────────────────────────────
describe("createBotOpponent", () => {
  it("creates a bot with isBot=true and bot_ id prefix", () => {
    const bot = createBotOpponent(p("human", 50));
    expect(bot.isBot).toBe(true);
    expect(bot.id.startsWith("bot_")).toBe(true);
    expect(bot.name).toBeTruthy();
  });
  it("bot points are within ±15 of the player", () => {
    for (let i = 0; i < 20; i++) {
      const bot = createBotOpponent(p("human", 50));
      expect(bot.points).toBeGreaterThanOrEqual(35);
      expect(bot.points).toBeLessThanOrEqual(65);
    }
  });
  it("bot difficulty matches player points", () => {
    expect(createBotOpponent(p("h", 5)).botLevel).toBe("easy");
    expect(createBotOpponent(p("h", 40)).botLevel).toBe("medium");
    expect(createBotOpponent(p("h", 80)).botLevel).toBe("hard");
  });
  it("bot points never go below 0", () => {
    for (let i = 0; i < 30; i++) {
      expect(createBotOpponent(p("h", 0)).points).toBeGreaterThanOrEqual(0);
    }
  });
});

// ── humanThinkDelayMs ─────────────────────────────────────────────────────────
describe("humanThinkDelayMs", () => {
  it("never exceeds (timeLimit - 1) × 1000", () => {
    for (let i = 0; i < 50; i++) {
      for (const level of ["easy", "medium", "hard"]) {
        const delay = humanThinkDelayMs(level, 3);
        expect(delay).toBeLessThanOrEqual(2000);
        expect(delay).toBeGreaterThanOrEqual(0);
      }
    }
  });
  it("easy delays start at >= 800ms", () => {
    for (let i = 0; i < 20; i++) {
      expect(humanThinkDelayMs("easy", 7)).toBeGreaterThanOrEqual(800);
    }
  });
  it("hard minimum delay is ≤ easy minimum delay", () => {
    let hardMin = Infinity;
    let easyMin = Infinity;
    for (let i = 0; i < 100; i++) {
      hardMin = Math.min(hardMin, humanThinkDelayMs("hard", 7));
      easyMin = Math.min(easyMin, humanThinkDelayMs("easy", 7));
    }
    expect(hardMin).toBeLessThanOrEqual(easyMin);
  });
});

// ── getAiMove — medium only (depth-3 = fast) ─────────────────────────────────
describe("getAiMove (medium)", () => {
  it("returns a legal placement on empty board", () => {
    const r = makeRoom();
    const move = getAiMove(r, "X", "medium");
    expect(move.type).toBe("place");
    expect(move.to).toBeGreaterThanOrEqual(0);
    expect(move.to).toBeLessThanOrEqual(8);
    expect(r.board[move.to]).toBeNull();
  });

  it("returns a legal move in movement phase", () => {
    const board: Cell[] = ["X", "O", null, "O", "X", null, null, "X", "O"];
    const r = makeRoom({ phase: "movement", board, placedCount: { X: 3, O: 3 } });
    const move = getAiMove(r, "X", "medium");
    expect(move.type).toBe("move");
    expect(move.from).toBeDefined();
    expect(r.board[move.from!]).toBe("X");
    expect(r.board[move.to]).toBeNull();
  });

  it("move is always in the legalMoves set (placement)", () => {
    const r = makeRoom();
    const m = getAiMove(r, "X", "medium");
    const legal = legalMoves(r, "X");
    expect(legal.find((l) => l.type === m.type && l.to === m.to)).toBeDefined();
  });

  it("move is always in the legalMoves set (movement)", () => {
    const board: Cell[] = ["X", "O", null, "O", "X", null, null, "X", "O"];
    const r = makeRoom({ phase: "movement", board, placedCount: { X: 3, O: 3 } });
    const m = getAiMove(r, "X", "medium");
    const legal = legalMoves(r, "X");
    expect(
      legal.find((l) => l.type === m.type && l.to === m.to && l.from === m.from)
    ).toBeDefined();
  });

  it("works correctly as O player", () => {
    const board: Cell[] = ["X", "O", null, null, "X", null, null, "O", "X"];
    const r = makeRoom({
      phase: "movement",
      board,
      placedCount: { X: 3, O: 3 },
      turn: "O",
    });
    const move = getAiMove(r, "O", "medium");
    expect(move.type).toBe("move");
    expect(r.board[move.from!]).toBe("O");
    expect(r.board[move.to]).toBeNull();
  });

  it("returns a valid move on a board with a winning opportunity", () => {
    // X at 0,1; cell 2 empty → win available. Medium has 20% noise so we
    // can't assert it always picks cell 2, but it must return a legal move.
    const board: Cell[] = ["X", "X", null, "O", "O", null, null, null, null];
    const r = makeRoom({ board, placedCount: { X: 2, O: 2 } });
    const move = getAiMove(r, "X", "medium");
    const legal = legalMoves(r, "X");
    expect(move.type).toBe("place");
    expect(legal.find((l) => l.to === move.to)).toBeDefined();
  });
});

// ── getAiMove — error case ────────────────────────────────────────────────────
describe("getAiMove (error)", () => {
  it("throws if no legal moves exist", () => {
    const board: Cell[] = ["O", "O", "O", null, null, null, null, null, null];
    const r = makeRoom({ phase: "movement", board, placedCount: { X: 3, O: 3 } });
    expect(() => getAiMove(r, "X", "medium")).toThrow("no legal moves");
  });
});
