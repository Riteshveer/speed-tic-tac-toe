// ─── White-Neon End-Game Screen ───────────────────────────────────────────────
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

  const emoji = isDraw ? "🤝" : isWinner ? "🏆" : "⚡";
  const title = isDraw ? "Draw Match!" : isWinner ? "Victory!" : "Defeat";
  const pts = isWinner ? (mode === "sudden-death" ? "+5 pts" : "+2 pts") : "";
  const titleColor = isWinner ? "#00c853" : isDraw ? "#0284c7" : "#ef4444";

  return (
    <div className="end-screen-overlay fade-in" id="end-screen">
      <div className="end-card-neon slide-up">
        <div className="end-emoji-wrap">{emoji}</div>
        <div className="end-title-neon" style={{ color: titleColor }}>
          {title}
        </div>
        {pts && <div className="end-pts-badge">{pts}</div>}
        <div className="end-subtitle-neon">
          {winner
            ? `${players[winner].name} wins this match`
            : "Neither player completed 3 in a row"}
        </div>

        <div className="end-actions-neon">
          <button
            id="btn-rematch"
            className="btn-neon btn-neon-primary"
            onClick={onRematch}
            disabled={myRematch}
          >
            {myRematch ? "✓ Waiting…" : "🔄 Play Again"}
          </button>
          <button id="btn-leave" className="btn-neon btn-neon-secondary" onClick={onLeave}>
            ← Leave Game
          </button>
        </div>

        {myRematch && !oppRematch && (
          <p className="rematch-waiting-neon">Waiting for opponent to accept…</p>
        )}
      </div>
    </div>
  );
}
