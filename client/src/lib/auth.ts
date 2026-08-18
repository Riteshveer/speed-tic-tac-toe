// ─── Supabase Auth ────────────────────────────────────────────────────────────
// Supports:
//   1. Anonymous sign-in  → persistent UUID without any friction
//   2. Google OAuth       → upgrade anonymous → Google (points carry over)
//   3. Local UUID fallback when Supabase is not configured (local dev)

import { createClient, User } from "@supabase/supabase-js";
import { AuthUser, PlayerInfo } from "@shared/types";

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL     ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

const SUPABASE_ENABLED =
  SUPABASE_URL.length > 0 &&
  SUPABASE_ANON_KEY.length > 0 &&
  !SUPABASE_URL.includes("placeholder") &&
  !SUPABASE_ANON_KEY.includes("placeholder");

export const supabase = SUPABASE_ENABLED
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,  // required for OAuth redirect
      },
    })
  : null;

// ─── Persistent localStorage keys ────────────────────────────────────────────
const ID_KEY   = "stt_player_id";
const NAME_KEY = "stt_player_name";
const PTS_KEY  = "stt_player_pts";

export function getSavedName(): string {
  return localStorage.getItem(NAME_KEY) ?? "";
}
export function saveName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}
export function syncLocalPoints(_id: string, pts: number): void {
  const cached = Number(localStorage.getItem(PTS_KEY) ?? "0");
  if (pts > cached) localStorage.setItem(PTS_KEY, String(pts));
}

// ─── Get current Supabase session (null if not configured) ───────────────────
export async function getCurrentUser(): Promise<User | null> {
  if (!supabase) return null;
  try {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.user ?? null;
  } catch { return null; }
}

// ─── Ensure we have SOME identity (anon or Google) ───────────────────────────
async function ensureSession(): Promise<string | null> {
  if (!supabase) return null;
  try {
    const user = await getCurrentUser();
    if (user) return user.id;

    // Sign in anonymously (Supabase creates a real but anonymous user)
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) { console.error("[auth] anon sign-in:", error.message); return null; }
    return data.user?.id ?? null;
  } catch (e) {
    console.warn("[auth] Supabase unavailable:", e);
    return null;
  }
}

// ─── Google OAuth sign-in ─────────────────────────────────────────────────────
// If user is currently anonymous, this LINKS (upgrades) their account.
// All points earned as anonymous carry over because the row id stays the same.
export async function signInWithGoogle(): Promise<void> {
  if (!supabase) {
    alert("Supabase is not configured. Add your Supabase keys to .env.local");
    return;
  }
  const user = await getCurrentUser();
  const isAnon = user?.is_anonymous ?? false;

  if (isAnon) {
    // Link anonymous user to Google identity (points carry over!)
    const { error } = await supabase.auth.linkIdentity({ provider: "google" });
    if (error) {
      console.error("[auth] linkIdentity error:", error.message);
      // Fall back to full redirect sign-in
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
    }
  } else {
    // Fresh sign-in
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin },
    });
  }
}

// ─── Sign out ─────────────────────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
  localStorage.removeItem(ID_KEY);
  localStorage.removeItem(NAME_KEY);
  localStorage.removeItem(PTS_KEY);
}

export async function buildAuthUser(): Promise<AuthUser | null> {
  const user = await getCurrentUser();
  let id = localStorage.getItem(ID_KEY);

  if (user) {
    if (id !== user.id) {
      id = user.id;
      localStorage.setItem(ID_KEY, id);
    }
  } else if (!id) {
    const sessionId = await ensureSession();
    id = sessionId ?? crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }

  const isGoogle = !!(user && !user.is_anonymous);

  // Fetch stored name from DB if Supabase available, else fallback to localStorage
  let name = localStorage.getItem(NAME_KEY) ?? "";
  let points = Number(localStorage.getItem(PTS_KEY) ?? "0");
  let usernameSet = false;

  if (supabase && user) {
    try {
      const { data } = await supabase
        .from("players")
        .select("name, points, username_set")
        .eq("id", user.id)
        .single();
      if (data) {
        name = (data.name as string) || name;
        points = (data.points as number) ?? points;
        usernameSet = (data.username_set as boolean) ?? false;
        saveName(name);
        localStorage.setItem(PTS_KEY, String(points));
      }
    } catch { /* use localStorage fallback */ }
  }

  return { id, name, points, isGoogle, usernameSet };
}

// ─── Build PlayerInfo (used when queuing for a match) ─────────────────────────
export async function buildPlayerInfo(name: string): Promise<PlayerInfo> {
  const user = await getCurrentUser();
  let id = localStorage.getItem(ID_KEY);
  if (user) {
    if (id !== user.id) {
      id = user.id;
      localStorage.setItem(ID_KEY, id);
    }
  } else if (!id) {
    const sessionId = await ensureSession();
    id = sessionId ?? crypto.randomUUID();
    localStorage.setItem(ID_KEY, id);
  }
  const points = Number(localStorage.getItem(PTS_KEY) ?? "0");
  saveName(name);
  return { id, name: name.trim(), points };
}

// ─── Set username via server REST API ─────────────────────────────────────────
const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

export async function submitUsername(
  userId: string,
  username: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (supabase) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }
    }
    const res = await fetch(`${SERVER_URL}/api/username/set`, {
      method: "POST",
      headers,
      body: JSON.stringify({ userId, username }),
    });
    const json = await res.json();
    if (json.ok) saveName(username);
    return json;
  } catch (e) {
    return { ok: false, error: "Network error — try again" };
  }
}

// ─── Listen for auth state changes ───────────────────────────────────────────
type AuthChangeCallback = (user: AuthUser | null) => void;
export function onAuthChange(cb: AuthChangeCallback): () => void {
  if (!supabase) return () => {};
  const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
    if (session?.user) {
      const authUser = await buildAuthUser();
      cb(authUser);
    } else {
      cb(null);
    }
  });
  return () => subscription.unsubscribe();
}
