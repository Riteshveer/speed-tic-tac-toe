// ─── App Root ─────────────────────────────────────────────────────────────────
// Manages view routing, socket lifecycle, and global state.

import { useEffect, useRef, useState } from "react";
import "./index.css";
import { GameStatePayload, Mode, Move, PlayerInfo, SE } from "@shared/types";
import { getSocket } from "./lib/socket";
import { sounds } from "./lib/sounds";
import Lobby from "./pages/Lobby";
import Searching from "./pages/Searching";
import GamePage from "./pages/GamePage";
import Leaderboard from "./pages/Leaderboard";

type View = "lobby" | "searching" | "game" | "leaderboard";

export default function App() {
  const [view, setView] = useState<View>("lobby");
  const [gameState, setGameState] = useState<GameStatePayload | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const playerRef = useRef<PlayerInfo | null>(null);
  const modeRef = useRef<Mode>("classic");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prevStatusRef = useRef<string>("");

  function showToast(msg: string, ms = 4000) {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }

  // ── Socket wiring ─────────────────────────────────────────────────────────
  useEffect(() => {
    const socket = getSocket();

    socket.on(SE.GAME_STATE, (state: GameStatePayload) => {
      setGameState((prev) => {
        // Sound: detect board changes
        if (prev && state.status === "playing") {
          const changed = state.board.some((c, i) => c !== prev.board[i]);
          if (changed) {
            if (state.phase === "placement") sounds.place();
            else sounds.move();
          }
        }
        // Sound: game over transition
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

  // ── Nav ───────────────────────────────────────────────────────────────────
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
      </nav>

      <main style={{ flex: 1 }}>
        {view === "lobby" && <Lobby onQueue={handleQueue} />}
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

      {/* Toast outside game page (for searching/lobby) */}
      {view !== "game" && toast && <div className="toast">{toast}</div>}
    </>
  );
}

