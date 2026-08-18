// ─── End-Game Screen ──────────────────────────────────────────────────────────
import { GameStatePayload } from "@shared/types";

interface EndScreenProps {
  state: GameStatePayload;
  onRematch: () => void;
  onLeave: () => void;
}

export default function EndScreen({ state, onRematch, onLeave }: EndScreenProps) {
  const { winner, myRole, players, mode, rematch } = state;

  const isWinner = winner === myRole;
  const isDraw = winner === null;
  const myRematch = rematch[myRole];
  const oppRole = myRole === "X" ? "O" : "X";
  const oppRematch = rematch[oppRole];

  const emoji = isDraw ? "🤝" : isWinner ? "🏆" : "😔";
  const title = isDraw ? "Draw!" : isWinner ? "You Won!" : "You Lost";
  const pts = isWinner ? (mode === "sudden-death" ? "+5 pts" : "+2 pts") : "";
  const color = isWinner ? "var(--accent-win)" : isDraw ? "var(--accent-gold)" : "#f87171";

  return (
    <div className="end-screen" id="end-screen">
      <div className="end-card">
        <span className="end-emoji">{emoji}</span>
        <div className="end-title" style={{ color }}>
          {title}
        </div>
        {pts && (
          <div style={{ color: "var(--accent-gold)", fontWeight: 700, fontSize: "1rem", marginBottom: 4 }}>
            {pts}
          </div>
        )}
        <div className="end-subtitle">
          {winner
            ? `${players[winner].name} wins this round`
            : "Neither player completed a line"}
        </div>

        <div className="end-actions">
          <button
            id="btn-rematch"
            className="btn btn-primary btn-lg"
            onClick={onRematch}
            disabled={myRematch}
          >
            {myRematch ? "✓ Waiting…" : "🔄 Rematch"}
          </button>
          <button id="btn-leave" className="btn btn-secondary" onClick={onLeave}>
            ← Back to Lobby
          </button>
        </div>

        {myRematch && !oppRematch && (
          <p className="rematch-waiting">Waiting for opponent…</p>
        )}
      </div>
    </div>
  );
}
