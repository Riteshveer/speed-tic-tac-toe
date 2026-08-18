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

  // Determine winning cells and get matching winning line index
  const winCells = new Set<number>();
  let winLineIndex: number | null = null;
  if (winner) {
    WIN_LINES.forEach((line, index) => {
      const vals = line.map((i) => board[i]);
      if (vals.every((v) => v === winner)) {
        line.forEach((i) => winCells.add(i));
        winLineIndex = index;
      }
    });
  }

  function getWinLineCoords(index: number) {
    switch (index) {
      case 0: return { x1: "10%", y1: "16.67%", x2: "90%", y2: "16.67%" };
      case 1: return { x1: "10%", y1: "50%", x2: "90%", y2: "50%" };
      case 2: return { x1: "10%", y1: "83.33%", x2: "90%", y2: "83.33%" };
      case 3: return { x1: "16.67%", y1: "10%", x2: "16.67%", y2: "90%" };
      case 4: return { x1: "50%", y1: "10%", x2: "50%", y2: "90%" };
      case 5: return { x1: "83.33%", y1: "10%", x2: "83.33%", y2: "90%" };
      case 6: return { x1: "12%", y1: "12%", x2: "88%", y2: "88%" };
      case 7: return { x1: "88%", y1: "12%", x2: "12%", y2: "88%" };
      default: return null;
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

        {winLineIndex !== null && (() => {
          const coords = getWinLineCoords(winLineIndex);
          if (!coords) return null;
          return (
            <svg className="winning-line-svg" viewBox="0 0 100 100">
              <defs>
                <linearGradient id="goldGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#FFE082" />
                  <stop offset="50%" stopColor="#FFD700" />
                  <stop offset="100%" stopColor="#FFB300" />
                </linearGradient>
              </defs>
              <line
                x1={coords.x1}
                y1={coords.y1}
                x2={coords.x2}
                y2={coords.y2}
                stroke="url(#goldGlowGrad)"
                strokeWidth="4"
                strokeLinecap="round"
              />
            </svg>
          );
        })()}
      </div>
    </div>
  );
}
