// ─── In-memory room registry ──────────────────────────────────────────────────
// Single-process store; scale with Redis if needed.

import { GameRoom, Player } from "../../../shared/types";

// roomId -> GameRoom
export const rooms = new Map<string, GameRoom>();

// socketId -> roomId
export const socketToRoom = new Map<string, string>();

// socketId -> Player role ("X" | "O")
export const socketToPlayer = new Map<string, Player>();

export function getRoomForSocket(
  socketId: string
): { room: GameRoom; role: Player } | null {
  const roomId = socketToRoom.get(socketId);
  const role = socketToPlayer.get(socketId);
  if (!roomId || !role) return null;
  const room = rooms.get(roomId);
  if (!room) return null;
  return { room, role };
}

export function cleanupSocket(socketId: string): void {
  socketToRoom.delete(socketId);
  socketToPlayer.delete(socketId);
}

export function cleanupRoom(roomId: string): void {
  rooms.delete(roomId);
}
