// ─── Lobby Page ───────────────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { Mode, PlayerInfo, AuthUser } from "@shared/types";
import {
  getSavedName,
  saveName,
  buildPlayerInfo,
  submitUsername,
  buildAuthUser,
  onAuthChange,
} from "../lib/auth";
import PlayTypeSelect from "../components/PlayTypeSelect";

const SERVER_URL = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";

interface LobbyProps {
  onQueue: (player: PlayerInfo, mode: Mode) => void;
  authUser?: AuthUser | null;
  onAuthUpdate?: (user: AuthUser | null) => void;
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
        background: "rgba(0,0,0,0.5)",
        backdropFilter: "blur(8px)",
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
export default function Lobby({ onQueue, authUser: propAuthUser, onAuthUpdate }: LobbyProps) {
  const [step, setStep] = useState<"type" | "mode">("type");
  const [name, setName] = useState(getSavedName());
  const [mode, setMode] = useState<Mode>("classic");
  const [nameError, setNameError] = useState("");
  const [loading, setLoading] = useState(false);
  const [localAuthUser, setLocalAuthUser] = useState<AuthUser | null>(propAuthUser ?? null);
  const [showUsernameModal, setShowUsernameModal] = useState(false);

  const authUser = propAuthUser ?? localAuthUser;

  useEffect(() => {
    buildAuthUser().then((u) => {
      setLocalAuthUser(u);
      if (onAuthUpdate) onAuthUpdate(u);
      if (u?.name) setName(u.name);
      if (u?.isGoogle && !u.usernameSet) setShowUsernameModal(true);
    });

    const unsub = onAuthChange(async (u) => {
      setLocalAuthUser(u);
      if (onAuthUpdate) onAuthUpdate(u);
      if (u?.name) setName(u.name);
      if (u?.isGoogle && !u.usernameSet) setShowUsernameModal(true);
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (name) saveName(name);
  }, [name]);

  function handleUsernameDone(chosenName: string) {
    setShowUsernameModal(false);
    setName(chosenName);
    const updated = authUser ? { ...authUser, name: chosenName, usernameSet: true } : null;
    setLocalAuthUser(updated);
    if (onAuthUpdate) onAuthUpdate(updated);
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

  const handlePlayWithFriends = () => {
    alert("Play with Friends private rooms are coming soon!");
  };

  if (step === "type") {
    return (
      <>
        {showUsernameModal && authUser && (
          <UsernameModal userId={authUser.id} onDone={handleUsernameDone} />
        )}
        <PlayTypeSelect
          onSelectPlayOnline={() => setStep("mode")}
          onSelectPlayWithFriends={handlePlayWithFriends}
        />
      </>
    );
  }

  return (
    <div className="lobby fade-in">
      {showUsernameModal && authUser && (
        <UsernameModal userId={authUser.id} onDone={handleUsernameDone} />
      )}

      <div className="lobby-hero">
        <button
          className="btn-back-link"
          onClick={() => setStep("type")}
        >
          ← Back to Play Options
        </button>
        <h1>Speed<br />Tic-Tac-Toe</h1>
        <p>Real-time multiplayer with shrinking timers,<br />skill-based matchmaking &amp; a global leaderboard.</p>
      </div>

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
          <p style={{ color: "#ef4444", fontSize: "0.8rem", marginTop: 6 }}>
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
