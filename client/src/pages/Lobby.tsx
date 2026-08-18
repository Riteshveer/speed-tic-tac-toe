// ─── Lobby Page ───────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Mode, PlayerInfo, AuthUser } from "@shared/types";
import {
  getSavedName,
  saveName,
  buildPlayerInfo,
  signInWithGoogle,
  signOut,
  submitUsername,
  buildAuthUser,
  onAuthChange,
} from "../lib/auth";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

interface LobbyProps {
  onQueue: (player: PlayerInfo, mode: Mode) => void;
}

// ─── Username pick modal ──────────────────────────────────────────────────────
function UsernameModal({
  userId,
  onDone,
}: {
  userId: string;
  onDone: (name: string) => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function checkAvailability(name: string) {
    if (name.length < 3) return;
    setChecking(true);
    try {
      const res = await fetch(
        `${SERVER_URL}/api/username/check?name=${encodeURIComponent(name)}`
      );
      const { available } = await res.json();
      if (!available) setError("Username already taken — try another");
      else setError("");
    } catch {
      setError("");
    } finally {
      setChecking(false);
    }
  }

  async function handleSubmit() {
    const trimmed = value.trim();
    if (trimmed.length < 3) { setError("At least 3 characters required"); return; }
    if (trimmed.length > 20) { setError("Maximum 20 characters"); return; }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      setError("Only letters, numbers, and underscores");
      return;
    }
    setSubmitting(true);
    const result = await submitUsername(userId, trimmed);
    setSubmitting(false);
    if (result.ok) {
      onDone(trimmed);
    } else {
      setError(result.error ?? "Could not save username");
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
    >
      <div
        className="card"
        style={{ width: 360, padding: "2rem", textAlign: "center" }}
      >
        <div style={{ fontSize: "2rem", marginBottom: 8 }}>🎮</div>
        <h2 className="display" style={{ fontSize: "1.4rem", marginBottom: 8 }}>
          Choose your username
        </h2>
        <p style={{ color: "var(--text-secondary)", fontSize: "0.85rem", marginBottom: 24 }}>
          3–20 chars, letters / numbers / underscores. This shows on the
          leaderboard.
        </p>
        <input
          className="name-input"
          autoFocus
          value={value}
          maxLength={20}
          placeholder="e.g. SpeedKing99"
          onChange={(e) => {
            setValue(e.target.value);
            setError("");
          }}
          onBlur={() => checkAvailability(value.trim())}
          onKeyDown={(e) => { if (e.key === "Enter") handleSubmit(); }}
        />
        {checking && (
          <p style={{ fontSize: "0.8rem", color: "var(--text-secondary)", marginTop: 6 }}>
            Checking availability…
          </p>
        )}
        {error && (
          <p style={{ fontSize: "0.8rem", color: "#f87171", marginTop: 6 }}>
            {error}
          </p>
        )}
        <button
          className="btn btn-primary btn-lg btn-full"
          style={{ marginTop: 20 }}
          onClick={handleSubmit}
          disabled={submitting || checking || value.trim().length < 3}
        >
          {submitting ? "Saving…" : "Save Username"}
        </button>
      </div>
    </div>
  );
}

// ─── Main Lobby ───────────────────────────────────────────────────────────────
export default function Lobby({ onQueue }: LobbyProps) {
  const [name, setName] = useState(getSavedName());
  const [mode, setMode] = useState<Mode>("classic");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showUsernameModal, setShowUsernameModal] = useState(false);
  const [signingIn, setSigningIn] = useState(false);

  // Load auth state on mount + listen for OAuth redirects
  useEffect(() => {
    buildAuthUser().then((u) => {
      setAuthUser(u);
      if (u?.name) setName(u.name);
      // Show username modal if Google user hasn't set a username yet
      if (u?.isGoogle && !u.usernameSet) setShowUsernameModal(true);
      setAuthLoading(false);
    });

    // Listen for OAuth redirects (e.g. returning from Google)
    const unsub = onAuthChange(async (u) => {
      setAuthUser(u);
      if (u?.name) setName(u.name);
      if (u?.isGoogle && !u.usernameSet) setShowUsernameModal(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (name) saveName(name);
  }, [name]);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    await signInWithGoogle();
    // After OAuth redirect, onAuthChange fires → setAuthUser
    setSigningIn(false);
  }

  async function handleSignOut() {
    await signOut();
    setAuthUser(null);
    setName("");
  }

  function handleUsernameDone(chosenName: string) {
    setShowUsernameModal(false);
    setName(chosenName);
    setAuthUser((u) => u ? { ...u, name: chosenName, usernameSet: true } : u);
  }

  async function handleStart() {
    const trimmed = name.trim();
    if (!trimmed) { setNameError("Enter your display name"); return; }
    if (trimmed.length < 3) { setNameError("At least 3 characters"); return; }
    if (trimmed.length > 20) { setNameError("Name must be ≤ 20 chars"); return; }
    setNameError("");
    setLoading(true);
    try {
      const player = await buildPlayerInfo(trimmed);
      onQueue(player, mode);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lobby fade-in">
      {showUsernameModal && authUser && (
        <UsernameModal userId={authUser.id} onDone={handleUsernameDone} />
      )}

      <div className="lobby-hero">
        <h1>Speed<br />Tic-Tac-Toe</h1>
        <p>Real-time multiplayer with shrinking timers,<br />skill-based matchmaking &amp; a global leaderboard.</p>
      </div>

      {/* ─── Auth row ──────────────────────────────────────────────────────── */}
      {!authLoading && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            padding: "10px 16px",
            background: "var(--bg-glass)",
            borderRadius: 12,
            border: "1px solid var(--border)",
          }}
        >
          {authUser?.isGoogle ? (
            <>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Signed in as <strong style={{ color: "var(--text-primary)" }}>{authUser.name}</strong>
                <span style={{ marginLeft: 8, color: "var(--color-o)" }}>
                  ✓ Google
                </span>
              </span>
              <button
                className="btn btn-secondary btn-sm"
                onClick={handleSignOut}
              >
                Sign out
              </button>
            </>
          ) : (
            <>
              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Playing as guest — points won't sync across devices
              </span>
              <button
                id="btn-google-signin"
                className="btn btn-secondary btn-sm"
                onClick={handleGoogleSignIn}
                disabled={signingIn}
                style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
                {signingIn ? "Redirecting…" : "Sign in with Google"}
              </button>
            </>
          )}
        </div>
      )}

      {/* ─── Name input (locked for Google users who set username) ──────────── */}
      <div>
        <label
          htmlFor="input-name"
          style={{ display: "block", fontSize: "0.85rem", fontWeight: 600, marginBottom: 8, color: "var(--text-secondary)" }}
        >
          Your Display Name
        </label>
        <input
          id="input-name"
          className="name-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleStart(); }}
          placeholder="Enter nickname…"
          maxLength={20}
          autoFocus={!authUser?.isGoogle}
          disabled={authUser?.isGoogle && authUser.usernameSet}
        />
        {authUser?.isGoogle && authUser.usernameSet && (
          <p style={{ fontSize: "0.75rem", color: "var(--text-secondary)", marginTop: 4 }}>
            Username locked — linked to your Google account
          </p>
        )}
        {nameError && (
          <p style={{ color: "#f87171", fontSize: "0.8rem", marginTop: 6 }}>
            {nameError}
          </p>
        )}
      </div>

      {/* ─── Mode selection ─────────────────────────────────────────────────── */}
      <div>
        <div style={{ fontSize: "0.85rem", fontWeight: 600, marginBottom: 12, color: "var(--text-secondary)" }}>
          Choose Mode
        </div>
        <div className="mode-cards">
          <button
            id="mode-classic"
            className={`mode-card ${mode === "classic" ? "selected-classic" : ""}`}
            onClick={() => setMode("classic")}
          >
            <div className="mode-card-icon">⏱️</div>
            <div className="mode-card-name text-o">Classic</div>
            <div className="mode-card-desc">
              Flat 7-second timer per move. Perfect for beginners.
              <br /><strong>+2 pts</strong> per win
            </div>
          </button>
          <button
            id="mode-sudden-death"
            className={`mode-card ${mode === "sudden-death" ? "selected-sudden-death" : ""}`}
            onClick={() => setMode("sudden-death")}
          >
            <div className="mode-card-icon">🔥</div>
            <div className="mode-card-name text-x">Sudden Death</div>
            <div className="mode-card-desc">
              Timer shrinks: 7→6→5→4→3s. Every move counts.
              <br /><strong>+5 pts</strong> per win
            </div>
          </button>
        </div>
      </div>

      {/* ─── Rules ──────────────────────────────────────────────────────────── */}
      <div className="card" style={{ background: "var(--bg-glass)", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>
        <div style={{ fontWeight: 700, color: "var(--text-primary)", marginBottom: 8 }}>📋 How to Play</div>
        <ul style={{ paddingLeft: 16 }}>
          <li><strong>Placement:</strong> each player drops 3 pieces on any empty cell.</li>
          <li><strong>Movement:</strong> pick up one of your pieces and move it anywhere empty.</li>
          <li><strong>Win:</strong> get your 3 pieces in any row, column, or diagonal.</li>
          <li><strong>Timeout:</strong> run out of time → instant loss!</li>
        </ul>
      </div>

      <button
        id="btn-find-match"
        className="btn btn-primary btn-lg btn-full"
        onClick={handleStart}
        disabled={loading}
      >
        {loading ? "Setting up…" : "⚡ Find Match"}
      </button>
    </div>
  );
}
