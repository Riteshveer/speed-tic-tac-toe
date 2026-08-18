// ─── Game Page ────────────────────────────────────────────────────────────────
import { GameStatePayload, Move } from "@shared/types";
import Board from "../components/Board";
import TimerRing from "../components/TimerRing";
import PlayerBanners from "../components/PlayerBanners";
import EndScreen from "../components/EndScreen";
import { getTimeLimit } from "../lib/gameUtils";

interface GamePageProps {
  state: GameStatePayload;
  onMove: (m: Move) => void;
  onRematch: () => void;
  onLeave: () => void;
  toast: string | null;
}

export default function GamePage({
  state,
  onMove,
  onRematch,
  onLeave,
  toast,
}: GamePageProps) {
  const { turn, myRole, phase, status, mode, deadline, moveCount } = state;
  const isMyTurn = turn === myRole && status === "playing";

  const currentTimeLimit = getTimeLimit(mode, moveCount?.[turn] ?? 0);

  function getInstruction(): string {
    if (status === "over") return "";
    if (!isMyTurn) return `Waiting for ${state.players[turn].name}…`;
    if (phase === "placement") {
      const left = 3 - state.placedCount[myRole];
      return `Click any empty cell to place (${left} piece${left !== 1 ? "s" : ""} left)`;
    }
    if (state.selected !== null) {
      return "Click an empty cell to move there, or click piece again to deselect";
    }
    return "Click one of your pieces to pick it up";
  }

  return (
    <div className="game-layout fade-in">
      <PlayerBanners state={state} />

      {/* Timer + phase badge */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 16 }}>
        <div className="timer-wrap">
          <TimerRing
            deadlineMs={deadline}
            totalSec={currentTimeLimit}
            player={turn}
            isMyTurn={isMyTurn}
          />
        </div>
        <div className="phase-badge">
          {phase === "placement" ? "📍 Placement" : "🚀 Movement"}
          <span className="text-muted" style={{ marginLeft: 4, fontSize: "0.75rem" }}>
            {mode === "classic" ? "Classic" : "Sudden Death 🔥"}
          </span>
        </div>
      </div>

      {/* Instruction */}
      <div
        className="instruction-bar"
        style={{
          color: isMyTurn ? "var(--text-primary)" : "var(--text-secondary)",
        }}
      >
        {getInstruction()}
      </div>

      <Board state={state} onMove={onMove} />

      {/* End screen overlay */}
      {status === "over" && (
        <EndScreen state={state} onRematch={onRematch} onLeave={onLeave} />
      )}

      {/* Disconnect toast */}
      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
