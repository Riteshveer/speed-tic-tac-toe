import { Player } from "@shared/types";

interface TurnIndicatorPillProps {
  turn: Player; // "X" | "O"
  status: "waiting" | "playing" | "over";
}

export default function TurnIndicatorPill({
  turn,
  status,
}: TurnIndicatorPillProps) {
  return (
    <div className="turn-indicator-pill-container">
      <div className={`turn-pill ${turn.toLowerCase()} ${status}`}>
        <div className={`turn-segment x-segment ${turn === "X" ? "active" : ""}`}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <path
              d="M6 6L18 18M18 6L6 18"
              stroke="currentColor"
              strokeWidth="3.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div className={`turn-segment o-segment ${turn === "O" ? "active" : ""}`}>
          <svg viewBox="0 0 24 24" width="18" height="18">
            <circle
              cx="12"
              cy="12"
              r="7"
              fill="none"
              stroke="currentColor"
              strokeWidth="3.5"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
