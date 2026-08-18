// ─── White-Neon End-Game Result Panel ───────────────────────────────────────────
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

  const winnerName = winner ? players[winner].name : "";

  return (
    <div className="result-panel-card fade-in" id="end-screen">
      {/* Trophy Badge */}
      <div className="result-badge">
        <svg className="trophy-icon" viewBox="0 0 24 24" fill="currentColor">
          <path d="M18 2H6v2H1v6c0 3.66 2.56 6.75 6 7.68V20H4v2h16v-2h-3v-2.32c3.44-.93 6-4.02 6-7.68V4h-5V2zm-1 8c0 2.76-2.24 5-5 5s-5-2.24-5-5V6h10v4z" />
        </svg>
      </div>

      <div className="result-content">
        <h2 className="result-title">
          {isDraw ? (
            "It's a draw!"
          ) : (
            <>
              <span className="result-winner-name">{winnerName}</span> wins this match!
            </>
          )}
        </h2>

        <p className="result-subtitle">
          Great game! 🎉
        </p>

        {isWinner && (
          <div className="result-points-tag">
            {mode === "sudden-death" ? "+5 pts" : "+2 pts"}
          </div>
        )}

        <div className="result-actions">
          <button
            id="btn-rematch"
            className="btn-result btn-result-primary"
            onClick={onRematch}
            disabled={myRematch}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
            </svg>
            <span>{myRematch ? "Waiting…" : "Play Again"}</span>
          </button>

          <button
            id="btn-leave"
            className="btn-result btn-result-secondary"
            onClick={onLeave}
          >
            <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
            </svg>
            <span>Leave Game</span>
          </button>
        </div>

        {myRematch && !oppRematch && (
          <p className="rematch-waiting-text">Waiting for opponent to accept…</p>
        )}
      </div>
    </div>
  );
}
