// ─── Rooms Registry Tests ─────────────────────────────────────────────────────
import { describe, it, expect, beforeEach } from "vitest";
import { rooms, socketToRoom, socketToPlayer, getRoomForSocket, cleanupSocket, cleanupRoom } from "./rooms";
import { createRoom } from "../game/logic";
import { PlayerInfo } from "../../../shared/types";

function p(name: string): PlayerInfo { return { id: name, name, points: 0 }; }

beforeEach(() => {
  rooms.clear();
  socketToRoom.clear();
  socketToPlayer.clear();
});

describe("getRoomForSocket", () => {
  it("returns room and role for a registered socket", () => {
    const room = createRoom("classic", p("a"), p("b"));
    rooms.set(room.roomId, room);
    socketToRoom.set("s1", room.roomId);
    socketToPlayer.set("s1", "X");
    const result = getRoomForSocket("s1");
    expect(result).not.toBeNull();
    expect(result!.room.roomId).toBe(room.roomId);
    expect(result!.role).toBe("X");
  });

  it("returns null for unknown socket", () => {
    expect(getRoomForSocket("unknown")).toBeNull();
  });

  it("returns null if room was deleted but maps remain", () => {
    socketToRoom.set("s1", "deleted-room");
    socketToPlayer.set("s1", "X");
    expect(getRoomForSocket("s1")).toBeNull();
  });
});

describe("cleanupSocket", () => {
  it("removes socket from both maps", () => {
    socketToRoom.set("s1", "room1");
    socketToPlayer.set("s1", "X");
    cleanupSocket("s1");
    expect(socketToRoom.has("s1")).toBe(false);
    expect(socketToPlayer.has("s1")).toBe(false);
  });
  it("does not throw for unknown socket", () => {
    expect(() => cleanupSocket("nope")).not.toThrow();
  });
});

describe("cleanupRoom", () => {
  it("removes room from the rooms map", () => {
    const room = createRoom("classic", p("a"), p("b"));
    rooms.set(room.roomId, room);
    cleanupRoom(room.roomId);
    expect(rooms.has(room.roomId)).toBe(false);
  });
});
