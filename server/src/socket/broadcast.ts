// ─── State Broadcast ──────────────────────────────────────────────────────────
// Emits game state to both players (injecting their personal 'myRole').

import { Server } from "socket.io";
import { GameRoom, GameStatePayload, Player, SE } from "../../../shared/types";
import { socketToPlayer, socketToRoom } from "./rooms";

export function broadcastState(
  room: GameRoom,
  io: Server,
  xSocketId: string,
  oSocketId: string
): void {
  const base: Omit<GameStatePayload, "myRole"> = {
    roomId: room.roomId,
    board: room.board,
    turn: room.turn,
    phase: room.phase,
    deadline: room.moveDeadline,
    mode: room.mode,
    status: room.status,
    winner: room.winner,
    players: {
      X: sanitizePlayer(room.players.X),
      O: sanitizePlayer(room.players.O),
    },
    placedCount: room.placedCount,
    moveCount: room.moveCount,
    selected: room.selected,
    rematch: room.rematch,
  };

  const xSock = io.sockets.sockets.get(xSocketId);
  if (xSock) xSock.emit(SE.GAME_STATE, { ...base, myRole: "X" } as GameStatePayload);

  const oSock = io.sockets.sockets.get(oSocketId);
  if (oSock) oSock.emit(SE.GAME_STATE, { ...base, myRole: "O" } as GameStatePayload);
}

// ─── Broadcast to all known sockets in a room ─────────────────────────────────
export function broadcastStateToRoom(
  room: GameRoom,
  io: Server
): void {
  // Find the two sockets registered to this room
  const xSocketId = findSocketForRole(room.roomId, "X");
  const oSocketId = findSocketForRole(room.roomId, "O");
  broadcastState(room, io, xSocketId ?? "", oSocketId ?? "");
}

export function findSocketForRole(
  roomId: string,
  role: Player
): string | undefined {
  for (const [sid, rid] of socketToRoom) {
    if (rid === roomId && socketToPlayer.get(sid) === role) return sid;
  }
  return undefined;
}

// Strip server-only fields from PlayerInfo before sending to clients.
function sanitizePlayer(p: { id: string; name: string; points: number; isBot?: boolean; botLevel?: string }) {
  // Never expose isBot / botLevel to clients
  return { id: p.id, name: p.name, points: p.points };
}
