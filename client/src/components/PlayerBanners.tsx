// ─── Player Banners (top of board) ───────────────────────────────────────────
import { GameStatePayload, Player } from "@shared/types";

interface PlayerBannersProps {
  state: GameStatePayload;
}

export default function PlayerBanners({ state }: PlayerBannersProps) {
  const { players, turn, myRole, placedCount } = state;
  const opp: Player = myRole === "X" ? "O" : "X";

  function banner(role: Player, side: "x" | "o") {
    const info = players[role];
    const isActive = turn === role && state.status === "playing";
    const placed = placedCount[role];
    const piecesLeft = 3 - placed;

    return (
      <div className={`player-banner ${side} ${isActive ? `active-${side}` : ""}`}>
        <div className={`role-badge text-${side}`}>{role} · {role === myRole ? "You" : "Them"}</div>
        <div className="player-name">{info.name}</div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: side === "o" ? "flex-end" : "flex-start", gap: 8, marginTop: 6 }}>
          <div className="pieces-left">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`piece-dot ${i < placed ? "placed" : ""}`}
                style={{
                  background: side === "x" ? "var(--accent-x)" : "var(--accent-o)",
                }}
              />
            ))}
          </div>
          <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
            {info.points} pts
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="player-banners">
      {banner("X", "x")}
      <div className="vs-badge">VS</div>
      {banner("O", "o")}
    </div>
  );
}
