// ─── Game Board Component ─────────────────────────────────────────────────────
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
  const { board, turn, phase, myRole, status, winner, placedCount, selected } = state;
  const [selectedCell, setSelectedCell] = useState<number | null>(null);
  const [prevBoard, setPrevBoard] = useState<Cell[]>(board);
  const [newCells, setNewCells] = useState<Set<number>>(new Set());

  const isMyTurn = turn === myRole && status === "playing";

  // Detect newly placed/moved pieces for animation
  useEffect(() => {
    const changed = new Set<number>();
    board.forEach((c, i) => { if (c !== prevBoard[i]) changed.add(i); });
    setNewCells(changed);
    setPrevBoard(board);
    // Clear selection on board change
    setSelectedCell(null);
  }, [board]);

  // Win line cells
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
      if (board[idx] !== null) return; // occupied
      if (placedCount[myRole] >= 3) return;
      onMove({ type: "place", to: idx });
    } else {
      // movement phase
      if (selectedCell === null) {
        // Select own piece
        if (board[idx] === myRole) setSelectedCell(idx);
      } else {
        if (idx === selectedCell) {
          setSelectedCell(null); // deselect
        } else if (board[idx] === myRole) {
          setSelectedCell(idx); // switch selection
        } else if (board[idx] === null) {
          // Move selected piece
          onMove({ type: "move", from: selectedCell, to: idx });
          setSelectedCell(null);
        }
      }
    }
  }

  function getCellClasses(idx: number, cell: Cell): string {
    let cls = "cell";
    if (cell === "X") cls += " x";
    if (cell === "O") cls += " o";
    if (winCells.has(idx)) cls += " winning";
    if (selectedCell === idx) cls += " selected";
    // Highlight valid targets when in movement phase with a piece selected
    if (isMyTurn && phase === "movement" && selectedCell !== null && cell === null) {
      cls += " placeable";
    }
    // Highlight empty cells in placement phase
    if (isMyTurn && phase === "placement" && cell === null && placedCount[myRole] < 3) {
      cls += " placeable";
    }
    if (!isMyTurn || status !== "playing") cls += " disabled";
    return cls;
  }

  return (
    <div className="board-wrapper">
      <div className="board" id="game-board">
        {board.map((cell, idx) => (
          <button
            key={idx}
            id={`cell-${idx}`}
            className={getCellClasses(idx, cell)}
            onClick={() => handleCellClick(idx)}
            aria-label={`Cell ${idx}: ${cell ?? "empty"}`}
          >
            {cell && (
              <span
                className={newCells.has(idx) ? "cell-symbol-enter" : ""}
                style={{ display: "inline-block" }}
              >
                {cell}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
