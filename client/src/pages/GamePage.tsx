// ─── White-Neon Game Page ───────────────────────────────────────────────────────
import { GameStatePayload, Move, Player } from "@shared/types";
import Board from "../components/Board";
import TimerRing from "../components/TimerRing";
import EndScreen from "../components/EndScreen";
import PlayerProfileCard from "../components/PlayerProfileCard";
import TurnIndicatorPill from "../components/TurnIndicatorPill";
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
  const { turn, myRole, phase, status, mode, deadline, moveCount, players } = state;
  const isMyTurn = turn === myRole && status === "playing";
  const oppRole: Player = myRole === "X" ? "O" : "X";

  const currentTimeLimit = getTimeLimit(mode, moveCount?.[turn] ?? 0);

  const player1 = players[myRole];
  const player2 = players[oppRole];

  // Ranks based on relative points
  const p1Rank = player1.points >= player2.points ? 1 : 2;
  const p2Rank = p1Rank === 1 ? 2 : 1;

  function getInstruction(): string {
    if (status === "over") return "";
    if (!isMyTurn) return `Waiting for ${players[turn].name}…`;
    if (phase === "placement") {
      const left = 3 - state.placedCount[myRole];
      return `Place your piece (${left} left)`;
    }
    if (state.selected !== null) {
      return "Click an empty cell to move, or click again to deselect";
    }
    return "Click your piece to pick it up";
  }

  return (
    <div className="neon-game-page fade-in">
      {/* Background Decor Shapes */}
      <div className="bg-decor-shape shape-x-top-right">✕</div>
      <div className="bg-decor-shape shape-o-bottom-left">◯</div>
      <div className="bg-decor-glow glow-top-left" />
      <div className="bg-decor-glow glow-bottom-right" />

      {/* Top Left: Player 1 (You) */}
      <div className="game-corner-player top-left-corner">
        <PlayerProfileCard
          playerInfo={player1}
          role={myRole}
          isYou={true}
          isActiveTurn={turn === myRole && status === "playing"}
          rank={p1Rank}
          position="top-left"
        />
      </div>

      {/* Center: Game Arena */}
      <div className="game-center-arena">
        {/* Phase & Timer Header */}
        <div className="game-header-bar">
          <div className="timer-wrap">
            <TimerRing
              deadlineMs={deadline}
              totalSec={currentTimeLimit}
              player={turn}
              isMyTurn={isMyTurn}
            />
          </div>
          <div className="phase-pill-badge">
            {phase === "placement" ? "📍 Placement Phase" : "🚀 Movement Phase"}
            <span className="mode-tag">
              {mode === "classic" ? "Classic" : "Sudden Death 🔥"}
            </span>
          </div>
        </div>

        {/* Dynamic turn instruction */}
        <div
          className={`instruction-banner ${isMyTurn ? "is-my-turn" : ""}`}
        >
          {getInstruction()}
        </div>

        {/* 3x3 Board */}
        <Board state={state} onMove={onMove} />

        {/* Dual Turn Toggle Switch Pill [ X | O ] */}
        <TurnIndicatorPill turn={turn} status={status} />
      </div>

      {/* Bottom Right: Player 2 (Opponent) */}
      <div className="game-corner-player bottom-right-corner">
        <PlayerProfileCard
          playerInfo={player2}
          role={oppRole}
          isYou={false}
          isActiveTurn={turn === oppRole && status === "playing"}
          rank={p2Rank}
          position="bottom-right"
        />
      </div>

      {/* End Screen Overlay */}
      {status === "over" && (
        <EndScreen state={state} onRematch={onRematch} onLeave={onLeave} />
      )}

      {/* Disconnect / Info Toast */}
      {toast && <div className="toast-neon">{toast}</div>}
    </div>
  );
}
