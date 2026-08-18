// ─── White-Neon Game Board Component ───────────────────────────────────────────
import { Cell, GameStatePayload, Move } from "@shared/types";
import { useEffect, useState } from "react";

interface BoardProps {
  state: GameStatePayload;
  onMove: (m: Move) => void;
}

const WIN_LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6],
];

export default function Board({ state, onMove }: BoardProps) {
  const { board, turn, phase, myRole, status, winner, placedCount } = state;
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [prevBoard, setPrevBoard] = useState<Cell[]>(board);
  const [newCells, setNewCells] = useState<Set<number>>(new Set());

  const isMyTurn = turn === myRole && status === "playing";

  // Detect newly placed/moved pieces for smooth pop animation
  useEffect(() => {
    const changed = new Set<number>();
    board.forEach((c, i) => { if (c !== prevBoard[i]) changed.add(i); });
    setNewCells(changed);
    setPrevBoard(board);
    setSelectedCell(null);
  }, [board]);

  // Determine winning cells
  const winCells = new Set<number>();
  if (winner) {
    for (const line of WIN_LINES) {
      const vals = line.map((i) => board[i]);
      if (vals.every((v) => v === winner)) line.forEach((i) => winCells.add(i));
    }
  }

  function handleCellClick(idx: number) {
    if (!isMyTurn) return;
    if (status !== "playing") return;

    if (phase === "placement") {
      if (board[idx] !== null) return;
      if (placedCount[myRole] >= 3) return;
      onMove({ type: "place", to: idx });
    } else {
      // movement phase
      if (selectedCell === null) {
        if (board[idx] === myRole) setSelectedCell(idx);
      } else {
        if (idx === selectedCell) {
          setSelectedCell(null);
        } else if (board[idx] === myRole) {
          setSelectedCell(idx);
        } else if (board[idx] === null) {
          onMove({ type: "move", from: selectedCell, to: idx });
          setSelectedCell(null);
        }
      }
    }
  }

  function getCellClasses(idx: number, cell: Cell): string {
    let cls = "neon-cell";
    if (cell === "X") cls += " cell-x";
    if (cell === "O") cls += " cell-o";
    if (winCells.has(idx)) cls += " cell-winning";
    if (selectedCell === idx) cls += " cell-selected";

    if (isMyTurn && phase === "movement" && selectedCell !== null && cell === null) {
      cls += " cell-placeable";
    }
    if (isMyTurn && phase === "placement" && cell === null && placedCount[myRole] < 3) {
      cls += " cell-placeable";
    }
    if (!isMyTurn || status !== "playing") cls += " cell-disabled";
    return cls;
  }

  return (
    <div className="neon-board-container">
      <div className="neon-board-card" id="game-board">
        {/* Grid divider lines */}
        <div className="grid-line vertical line-1" />
        <div className="grid-line vertical line-2" />
        <div className="grid-line horizontal line-1" />
        <div className="grid-line horizontal line-2" />

        <div className="neon-grid">
          {board.map((cell, idx) => (
            <button
              key={idx}
              id={`cell-${idx}`}
              className={getCellClasses(idx, cell)}
              onClick={() => handleCellClick(idx)}
              aria-label={`Cell ${idx}: ${cell ?? "empty"}`}
            >
              {cell && (
                <div className={`cell-symbol-wrap ${newCells.has(idx) ? "symbol-pop-in" : ""}`}>
                  {cell === "O" ? (
                    <svg className="neon-symbol symbol-o" viewBox="0 0 100 100">
                      <circle
                        cx="50"
                        cy="50"
                        r="34"
                        fill="none"
                        stroke="url(#cyanGlowGrad)"
                        strokeWidth="12"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="cyanGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#00e5ff" />
                          <stop offset="100%" stopColor="#00b4d8" />
                        </linearGradient>
                      </defs>
                    </svg>
                  ) : (
                    <svg className="neon-symbol symbol-x" viewBox="0 0 100 100">
                      <path
                        d="M26 26 L74 74 M74 26 L26 74"
                        fill="none"
                        stroke="url(#blueGlowGrad)"
                        strokeWidth="13"
                        strokeLinecap="round"
                      />
                      <defs>
                        <linearGradient id="blueGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#60a5fa" />
                          <stop offset="100%" stopColor="#2563eb" />
                        </linearGradient>
                      </defs>
                    </svg>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
