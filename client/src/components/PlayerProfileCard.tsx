import { PlayerInfo, Player } from "@shared/types";

interface PlayerProfileCardProps {
  playerInfo: PlayerInfo;
  role: Player; // "X" | "O"
  isYou: boolean;
  isActiveTurn: boolean;
  rank?: number;
  position: "top-left" | "bottom-right";
}

export default function PlayerProfileCard({
  playerInfo,
  role,
  isYou,
  isActiveTurn,
  rank = 1,
  position,
}: PlayerProfileCardProps) {
  const avatarSeed = encodeURIComponent(playerInfo.id || playerInfo.name || "player");
  // Reliable high quality futuristic/friendly avatar via Dicebear
  const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${avatarSeed}&backgroundColor=b6e3f4,c0aede,d1d4f9`;

  const handleName = playerInfo.name.startsWith("@")
    ? playerInfo.name
    : `@${playerInfo.name}`;

  return (
    <div
      className={`player-card-neon ${position} ${role.toLowerCase()} ${
        isActiveTurn ? "active-turn" : ""
      }`}
    >
      <div className="player-card-avatar-wrap">
        <img
          src={avatarUrl}
          alt={playerInfo.name}
          className="player-card-avatar"
          onError={(e) => {
            // Fallback SVG graphic if offline/error
            (e.target as HTMLImageElement).src = `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="50" cy="50" r="50" fill="%23e0f2fe"/><circle cx="50" cy="35" r="20" fill="%230284c7"/><path d="M 20 85 C 20 60, 80 60, 80 85 Z" fill="%230284c7"/></svg>`;
          }}
        />
        {isActiveTurn && <div className="avatar-pulse-ring" />}
      </div>

      <div className="player-card-info">
        <div className="player-card-name-row">
          <span className="player-card-name" title={playerInfo.name}>
            {handleName}
          </span>
          {isYou && <span className="you-badge">YOU</span>}
        </div>

        <div className="player-card-rank">Rank #{rank}</div>

        <div className="player-card-score-pill">
          <svg
            className="star-icon"
            viewBox="0 0 24 24"
            fill="currentColor"
            width="14"
            height="14"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <span>{playerInfo.points.toLocaleString()}</span>
        </div>
      </div>

      <div className={`player-card-symbol-badge ${role.toLowerCase()}`}>
        {role === "O" ? (
          <svg className="symbol-o-icon" viewBox="0 0 40 40">
            <circle
              cx="20"
              cy="20"
              r="13"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
            />
          </svg>
        ) : (
          <svg className="symbol-x-icon" viewBox="0 0 40 40">
            <path
              d="M11 11 L29 29 M29 11 L11 29"
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    </div>
  );
}
