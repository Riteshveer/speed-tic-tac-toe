// ─── Supabase helpers ─────────────────────────────────────────────────────────
// All DB writes are server-side only (service-role key bypasses RLS).
// Points are awarded atomically via the increment_points RPC.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { LeaderboardEntry, LeaderboardResponse, Mode } from "../../../shared/types";

let _db: SupabaseClient | null = null;

// Returns null when env vars are absent (local dev without Supabase)
export function getDb(): SupabaseClient | null {
  if (_db) return _db;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || url.includes("placeholder") || key.includes("placeholder")) {
    return null;
  }
  _db = createClient(url, key, { auth: { persistSession: false } });
  return _db;
}

// ─── Score per mode ────────────────────────────────────────────────────────────
export function scoreForMode(mode: Mode): number {
  return mode === "sudden-death" ? 5 : 2;
}

// ─── Ensure player row exists (upsert on first join) ─────────────────────────
export async function upsertPlayer(
  id: string,
  name: string
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const { error } = await db
    .from("players")
    .upsert(
      { id, name, points: 0 },
      { onConflict: "id", ignoreDuplicates: true }
    );
  if (error) console.error("[db] upsertPlayer error:", error.message);
}

// ─── Username availability check ──────────────────────────────────────────────
export async function checkUsernameAvailable(username: string): Promise<boolean> {
  const db = getDb();
  if (!db) return true; // allow in local dev
  const { data, error } = await db.rpc("check_username_available", {
    username_candidate: username,
  });
  if (error) {
    console.error("[db] checkUsernameAvailable error:", error.message);
    return false;
  }
  return data as boolean;
}

// ─── Set username for a player (first login or rename) ────────────────────────
export async function setUsername(
  id: string,
  username: string
): Promise<{ ok: boolean; error?: string }> {
  const db = getDb();
  if (!db) return { ok: true }; // no-op in local dev

  // Validate server-side
  const trimmed = username.trim();
  if (trimmed.length < 3 || trimmed.length > 20) {
    return { ok: false, error: "Username must be 3–20 characters" };
  }
  if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
    return { ok: false, error: "Only letters, numbers, and underscores allowed" };
  }

  // Check availability
  const available = await checkUsernameAvailable(trimmed);
  if (!available) {
    return { ok: false, error: "Username already taken — try another" };
  }

  const { error } = await db
    .from("players")
    .upsert(
      { id, name: trimmed, points: 0, username_set: true },
      { onConflict: "id" }
    );

  if (error) {
    // Unique constraint violation (race condition)
    if (error.code === "23505") {
      return { ok: false, error: "Username already taken — try another" };
    }
    console.error("[db] setUsername error:", error.message);
    return { ok: false, error: "Could not save username, try again" };
  }
  return { ok: true };
}

// ─── Atomic points increment ──────────────────────────────────────────────────
export async function awardPoints(
  winnerId: string,
  mode: Mode
): Promise<void> {
  if (!winnerId || winnerId.startsWith("bot_")) return;
  const db = getDb();
  if (!db) return;
  const pts = scoreForMode(mode);
  const { error } = await db.rpc("increment_points", {
    player_id: winnerId,
    delta: pts,
  });
  if (error) {
    console.error("[db] awardPoints error:", error.message);
    // Fallback: read-modify-write
    const { data } = await db
      .from("players")
      .select("points")
      .eq("id", winnerId)
      .single();
    if (data) {
      await db
        .from("players")
        .update({ points: (data.points as number) + pts, updated_at: new Date().toISOString() })
        .eq("id", winnerId);
    }
  }
}

// ─── Leaderboard: TOP 100, stable tie-break by created_at ASC ─────────────────
export async function getLeaderboard(
  limit = 100
): Promise<LeaderboardEntry[]> {
  const db = getDb();
  if (!db) return [];
  const { data, error } = await db
    .from("players")
    .select("name, points")
    .order("points", { ascending: false })
    .order("created_at", { ascending: true }) // earlier account wins tie
    .limit(limit);
  if (error) {
    console.error("[db] getLeaderboard error:", error.message);
    return [];
  }
  return (data ?? []).map((row, i) => ({
    rank: i + 1,
    name: row.name as string,
    points: row.points as number,
  }));
}

// ─── Player's own rank (count of players with strictly more points + 1) ───────
export async function getPlayerEntry(
  playerId: string
): Promise<{ rank: number; name: string; points: number } | null> {
  const db = getDb();
  if (!db) return null;

  // Fetch the player's own row
  const { data: player, error: playerError } = await db
    .from("players")
    .select("name, points")
    .eq("id", playerId)
    .single();
  if (playerError || !player) return null;

  // Count players strictly above
  const { count, error: countError } = await db
    .from("players")
    .select("*", { count: "exact", head: true })
    .gt("points", player.points as number);
  if (countError) return null;

  return {
    rank: (count ?? 0) + 1,
    name: player.name as string,
    points: player.points as number,
  };
}

// ─── Full leaderboard response (top100 + caller's own entry) ─────────────────
export async function getLeaderboardResponse(
  callerId?: string
): Promise<LeaderboardResponse> {
  const [top100, myEntry] = await Promise.all([
    getLeaderboard(100),
    callerId ? getPlayerEntry(callerId) : Promise.resolve(null),
  ]);
  return { top100, myEntry };
}
