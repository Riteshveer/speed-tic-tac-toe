"use strict";
// ─── Shared Types ────────────────────────────────────────────────────────────
// Used by both client (React/Vite) and server (Node/Socket.IO).
// This file is intentionally import-free for dual bundling.
Object.defineProperty(exports, "__esModule", { value: true });
exports.SE = void 0;
// ─── Socket Event Names (runtime const) ───────────────────────────────────────
exports.SE = {
    // client -> server
    QUEUE_JOIN: "queue:join",
    MOVE_MAKE: "move:make",
    REMATCH_VOTE: "rematch:vote",
    DISCONNECT: "disconnect",
    USERNAME_CHECK: "username:check", // { username } → { available }
    USERNAME_SET: "username:set", // { userId, username } → { ok, error? }
    // server -> client
    QUEUE_STATUS: "queue:status",
    GAME_STATE: "game:state",
    GAME_ERROR: "game:error",
    GAME_END: "game:end",
    OPPONENT_DISCONNECTED: "opponent:disconnected",
    LEADERBOARD: "leaderboard:data",
};
