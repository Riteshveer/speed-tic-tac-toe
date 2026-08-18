// ─── Shared Types ────────────────────────────────────────────────────────────
// Used by both client (React/Vite) and server (Node/Socket.IO).
// This file is intentionally import-free for dual bundling.

export type Player = "X" | "O";
export type Mode = "classic" | "sudden-death";
export type Phase = "placement" | "movement";
export type Cell = Player | null; // 9-length board, index 0..8

export interface PlayerInfo {
  id: string;
  name: string;
  points: number;
  isBot?: boolean;
  botLevel?: "easy" | "medium" | "hard";
}

export interface GameRoom {
  roomId: string;
  mode: Mode;
  players: { X: PlayerInfo; O: PlayerInfo };
  board: Cell[]; // length 9
  phase: Phase;
  placedCount: { X: number; O: number }; // caps at 3
  moveCount: { X: number; O: number };   // drives timer ramp
  turn: Player;
  selected: number | null;               // picked-up cell in movement phase
  moveDeadline: number;                  // epoch ms
  status: "waiting" | "playing" | "over";
  winner: Player | null;
  rematch: { X: boolean; O: boolean };
  timer?: ReturnType<typeof setTimeout>; // active turn timeout handle
}

export interface Move {
  type: "place" | "move";
  to: number;     // target empty cell 0..8
  from?: number;  // required when type === "move"
}

// ─── Socket Event Payloads ────────────────────────────────────────────────────

export interface QueueJoinPayload {
  player: PlayerInfo;
  mode: Mode;
}

export interface GameStatePayload {
  roomId: string;
  board: Cell[];
  turn: Player;
  phase: Phase;
  deadline: number;
  mode: Mode;
  status: "waiting" | "playing" | "over";
  winner: Player | null;
  players: { X: PlayerInfo; O: PlayerInfo };
  placedCount: { X: number; O: number };
  moveCount: { X: number; O: number };
  selected: number | null;
  rematch: { X: boolean; O: boolean };
  myRole: Player; // injected per-socket, not stored in room
}

// ─── Leaderboard ─────────────────────────────────────────────────────────────

export interface LeaderboardEntry {
  rank: number;
  name: string;
  points: number;
  isMe?: boolean; // client-side only: marks the signed-in user's row
}

export interface LeaderboardResponse {
  top100: LeaderboardEntry[];
  myEntry: { rank: number; name: string; points: number } | null;
}

// ─── Auth / Username ──────────────────────────────────────────────────────────

export interface AuthUser {
  id: string;
  name: string;
  points: number;
  isGoogle: boolean;        // true if logged in via Google OAuth
  usernameSet: boolean;     // false = first login, prompt for username
}

// ─── Socket Event Names (runtime const) ───────────────────────────────────────
export const SE = {
  // client -> server
  QUEUE_JOIN:       "queue:join"       as const,
  MOVE_MAKE:        "move:make"        as const,
  REMATCH_VOTE:     "rematch:vote"     as const,
  DISCONNECT:       "disconnect"       as const,
  USERNAME_CHECK:   "username:check"   as const,  // { username } → { available }
  USERNAME_SET:     "username:set"     as const,  // { userId, username } → { ok, error? }

  // server -> client
  QUEUE_STATUS:          "queue:status"          as const,
  GAME_STATE:            "game:state"            as const,
  GAME_ERROR:            "game:error"            as const,
  GAME_END:              "game:end"              as const,
  OPPONENT_DISCONNECTED: "opponent:disconnected" as const,
  LEADERBOARD:           "leaderboard:data"      as const,
};
