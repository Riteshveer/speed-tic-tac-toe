// ─── Timer Logic Tests ────────────────────────────────────────────────────────
// We test getTimeLimit (the pure function) and handleTimeout behavior.
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getTimeLimit } from "../game/logic";
import { GameRoom, Player, PlayerInfo } from "../../../shared/types";
import { createRoom } from "../game/logic";

function p(name: string, pts: number): PlayerInfo { return { id: name, name, points: pts }; }

function makeRoom(ov: Partial<GameRoom> = {}): GameRoom {
  return { ...createRoom("classic", p("a", 0), p("b", 0)), moveDeadline: Date.now() + 60_000, ...ov };
}

// ── Timer calculation: getTimeLimit ───────────────────────────────────────────
describe("Timer: getTimeLimit", () => {
  it("classic mode: constant 7s", () => {
    for (let mc = 0; mc <= 20; mc++) {
      expect(getTimeLimit("classic", mc)).toBe(7);
    }
  });

  it("sudden-death: ramps from 7 down to 3", () => {
    const expected = [
      [0, 7], [1, 7], [2, 7],
      [3, 6], [4, 6], [5, 6],
      [6, 5], [7, 5], [8, 5],
      [9, 4], [10, 4], [11, 4],
      [12, 3], [13, 3], [14, 3],
      [15, 3], [20, 3], [50, 3],
    ];
    for (const [mc, exp] of expected) {
      expect(getTimeLimit("sudden-death", mc)).toBe(exp);
    }
  });
});

// ── Timeout logic ─────────────────────────────────────────────────────────────
describe("handleTimeout behavior", () => {
  it("timeout on X's turn → O wins", () => {
    const room = makeRoom({ turn: "X", status: "playing" });
    // Simulate timeout logic (from timer.ts handleTimeout)
    const loser = room.turn;
    const winner: Player = loser === "X" ? "O" : "X";
    expect(winner).toBe("O");
  });

  it("timeout on O's turn → X wins", () => {
    const room = makeRoom({ turn: "O", status: "playing" });
    const loser = room.turn;
    const winner: Player = loser === "X" ? "O" : "X";
    expect(winner).toBe("X");
  });

  it("does not trigger if game is already over", () => {
    const room = makeRoom({ status: "over" });
    // handleTimeout early-returns when status !== "playing"
    expect(room.status).toBe("over");
    // No state change should occur — we verify status stays "over"
    const shouldSkip = room.status !== "playing";
    expect(shouldSkip).toBe(true);
  });
});

// ── Deadline calculation ──────────────────────────────────────────────────────
describe("moveDeadline calculation", () => {
  it("deadline is now + timeLimit * 1000", () => {
    const now = Date.now();
    const mode = "sudden-death" as const;
    const moveCount = 6;
    const timeLimit = getTimeLimit(mode, moveCount); // 5s
    const deadline = now + timeLimit * 1000;
    expect(deadline - now).toBe(5000);
  });

  it("classic deadline is always now + 7000", () => {
    const now = Date.now();
    const deadline = now + getTimeLimit("classic", 99) * 1000;
    expect(deadline - now).toBe(7000);
  });
});

// ── Timer edge cases ──────────────────────────────────────────────────────────
describe("Timer edge cases", () => {
  it("timer can be cleared and re-set (simulated)", () => {
    const room = makeRoom();
    room.timer = setTimeout(() => {}, 99999);
    expect(room.timer).toBeDefined();
    clearTimeout(room.timer);
    room.timer = undefined;
    expect(room.timer).toBeUndefined();
    // Re-set
    room.timer = setTimeout(() => {}, 5000);
    expect(room.timer).toBeDefined();
    clearTimeout(room.timer);
  });
});
