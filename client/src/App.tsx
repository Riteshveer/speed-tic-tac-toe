// ─── App Root ─────────────────────────────────────────────────────────────────
// Manages view routing, socket lifecycle, global auth state, and navbar.

import { useEffect, useRef, useState } from "react";
import "./index.css";
import { AuthUser, GameStatePayload, Mode, Move, PlayerInfo, SE } from "@shared/types";
import { getSocket } from "./lib/socket";
import { sounds } from "./lib/sounds";
import { buildAuthUser, onAuthChange, signInWithGoogle, signOut, setupDeepLinks } from "./lib/auth";
import Lobby from "./pages/Lobby";
import Searching from "./pages/Searching";
import GamePage from "./pages/GamePage";
import Leaderboard from "./pages/Leaderboard";

type View = "lobby" | "searching" | "game" | "leaderboard";

export default function App() {
  const [view, setView] = useState<View>("lobby");
  const [gameState, setGameState] = useState<GameStatePayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [signingIn, setSigningIn] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const playerRef = useRef<PlayerInfo | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Click outside profile dropdown handler
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownOpen]);
  const modeRef = useRef<Mode>("classic");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<string>("");

  function showToast(msg: string, ms = 4000) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  // ── Auth wiring for Navbar ─────────────────────────────────────────────────
  useEffect(() => {
    buildAuthUser()
      .then((u) => {
        setAuthUser(u);
      })
      .catch((e) => {
        console.error("[app] auth load error:", e);
      })
      .finally(() => {
        setAuthLoading(false);
      });

    const unsub = onAuthChange((u) => {
      setAuthUser(u);
      setAuthLoading(false);
    });

    const unsubDeepLinks = setupDeepLinks(() => {
      buildAuthUser().then((u) => setAuthUser(u));
    });

    return () => {
      unsub();
      unsubDeepLinks();
    };
  }, []);

  async function handleGoogleSignIn() {
    setSigningIn(true);
    await signInWithGoogle();
    setSigningIn(false);
  }

  async function handleSignOut() {
    await signOut();
    setAuthUser(null);
  }

  // ── Socket wiring ─────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    socket.on(SE.GAME_STATE, (state: GameStatePayload) => {
      setGameState((prev) => {
        if (prev && state.status === "playing") {
          const changed = state.board.some((c, i) => c !== prev.board[i]);
          if (changed) {
            if (state.phase === "placement") sounds.place();
            else sounds.move();
          }
        }
        if (state.status === "over" && prevStatusRef.current !== "over") {
          if (state.winner === state.myRole) sounds.win();
          else if (state.winner !== null) sounds.lose();
        }
        prevStatusRef.current = state.status;
        return state;
      });
      if (view !== "game") setView("game");
    });

    socket.on(SE.QUEUE_STATUS, ({ searching }: { searching: boolean }) => {
      if (searching) setView("searching");
    });

    socket.on(SE.GAME_ERROR, ({ message }: { message: string }) => {
      showToast(`⚠️ ${message}`);
    });

    socket.on(SE.OPPONENT_DISCONNECTED, () => {
      showToast("⚡ Opponent disconnected. Waiting 15s for reconnect…", 15000);
      sounds.timeout();
    });

    socket.on("connect", () => console.log("[socket] connected"));
    socket.on("disconnect", (reason) => {
      console.log("[socket] disconnected:", reason);
      showToast("🔌 Connection lost. Reconnecting…");
    });

    return () => {
      socket.off(SE.GAME_STATE);
      socket.off(SE.QUEUE_STATUS);
      socket.off(SE.GAME_ERROR);
      socket.off(SE.OPPONENT_DISCONNECTED);
    };
  }, []);

  // ── Actions ───────────────────────────────────────────────────────────────
  function handleQueue(player: PlayerInfo, mode: Mode) {
    playerRef.current = player;
    modeRef.current = mode;
    const socket = getSocket();
    socket.emit(SE.QUEUE_JOIN, { player, mode });
    setView("searching");
  }

  function handleCancelSearch() {
    const socket = getSocket();
    socket.disconnect();
    socket.connect();
    setView("lobby");
  }

  function handleMove(m: Move) {
    const socket = getSocket();
    socket.emit(SE.MOVE_MAKE, m);
  }

  function handleRematch() {
    sounds.rematch();
    const socket = getSocket();
    socket.emit(SE.REMATCH_VOTE);
  }

  function handleLeave() {
    setGameState(null);
    prevStatusRef.current = "";
    setView("lobby");
  }

  function navTo(v: View) {
    if (v === view) return;
    if (v === "lobby" && (view === "game" || view === "searching")) {
      handleLeave();
    } else {
      setView(v);
    }
  }

  const inGame = view === "game" || view === "searching";

  return (
    <>
      <div className="app-bg" />
      <nav className="navbar">
        <span className="navbar-logo">⚡ SpeedTTT</span>

        <div className="navbar-right">
          <div className="navbar-tabs">
            <button
              id="nav-play"
              className={`navbar-tab ${view === "lobby" || inGame ? "active" : ""}`}
              onClick={() => navTo("lobby")}
            >
              Play
            </button>
            <button
              id="nav-leaderboard"
              className={`navbar-tab ${view === "leaderboard" ? "active" : ""}`}
              onClick={() => navTo("leaderboard")}
            >
              Leaderboard
            </button>
          </div>

          {/* Compact Header Auth UI with Dropdown */}
          {!authLoading && authUser && (
            <div className="navbar-auth" ref={dropdownRef}>
              <button
                className="nav-profile-trigger"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                aria-expanded={dropdownOpen}
                aria-haspopup="true"
              >
                <img
                  src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(
                    authUser.name || "user"
                  )}`}
                  alt={authUser.name}
                  className="nav-user-avatar"
                />
                <span className="nav-user-name" title={authUser.name}>
                  {authUser.name}
                </span>
                <svg
                  className={`nav-chevron ${dropdownOpen ? "open" : ""}`}
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>

              {dropdownOpen && (
                <div className="nav-profile-dropdown slide-down">
                  <div className="nav-dropdown-header">
                    <span className="nav-dropdown-role">
                      {authUser.isGoogle ? "Linked Account" : "Guest Player"}
                    </span>
                    <span className="nav-dropdown-points">
                      Points: <strong>{authUser.points}</strong>
                    </span>
                  </div>
                  <div className="nav-dropdown-divider" />
                  <div className="nav-dropdown-actions">
                    {authUser.isGoogle ? (
                      <button className="btn-dropdown-action btn-dropdown-signout" onClick={() => { handleSignOut(); setDropdownOpen(false); }}>
                        <svg className="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                        </svg>
                        <span>Sign Out</span>
                      </button>
                    ) : (
                      <button className="btn-dropdown-action btn-dropdown-google" onClick={() => { handleGoogleSignIn(); setDropdownOpen(false); }} disabled={signingIn}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                            fill="#4285F4"
                          />
                          <path
                            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                            fill="#34A853"
                          />
                          <path
                            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                            fill="#FBBC05"
                          />
                          <path
                            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                            fill="#EA4335"
                          />
                        </svg>
                        <span>{signingIn ? "Connecting…" : "Link Google"}</span>
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      <main style={{ flex: 1 }}>
        {view === "lobby" && (
          <Lobby
            onQueue={handleQueue}
            authUser={authUser}
            onAuthUpdate={setAuthUser}
          />
        )}
        {view === "searching" && <Searching onCancel={handleCancelSearch} />}
        {view === "game" && gameState && (
          <GamePage
            state={gameState}
            onMove={handleMove}
            onRematch={handleRematch}
            onLeave={handleLeave}
            toast={toast}
          />
        )}
        {view === "leaderboard" && <Leaderboard />}
      </main>

      {/* Toast outside game page */}
      {view !== "game" && toast && <div className="toast-neon">{toast}</div>}
    </>
  );
}
