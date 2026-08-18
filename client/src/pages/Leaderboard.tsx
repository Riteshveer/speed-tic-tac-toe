// ─── Leaderboard Page ─────────────────────────────────────────────────────────
// Polling every 12 s (no Realtime — free tier caps Realtime at ~200 connections).
// Pauses polling when tab is hidden; resumes on visibility.
// Always shows the signed-in user's own rank, even outside the top 100.

import { useEffect, useRef, useState, useCallback } from "react";
import { LeaderboardEntry, LeaderboardResponse } from "@shared/types";
import { buildAuthUser } from "../lib/auth";

const SERVER_URL          = import.meta.env.VITE_SERVER_URL ?? "http://localhost:3001";
const LEADERBOARD_POLL_MS = 12_000;

export default function Leaderboard() {
  const [top100, setTop100]       = useState<LeaderboardEntry[]>([]);
  const [myEntry, setMyEntry]     = useState<{ rank: number; name: string; points: number } | null>(null);
  const [loading, setLoading]     = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [error, setError]         = useState<string | null>(null);
  const intervalRef               = useRef<ReturnType<typeof setInterval> | null>(null);
  const myIdRef                   = useRef<string | null>(null);

  // Resolve the current user id once on mount
  useEffect(() => {
    buildAuthUser().then((u) => {
      myIdRef.current = u?.id ?? null;
    });
  }, []);

  // ── Fetch logic ─────────────────────────────────────────────────────────────
  const fetchLeaderboard = useCallback(async () => {
    try {
      const userId = myIdRef.current;
      const url    = userId
        ? `${SERVER_URL}/api/leaderboard?userId=${encodeURIComponent(userId)}`
        : `${SERVER_URL}/api/leaderboard`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: LeaderboardResponse = await res.json();
      setTop100(data.top100 ?? []);
      setMyEntry(data.myEntry ?? null);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      console.warn("[leaderboard] fetch failed:", e);
      setError("Could not load leaderboard. Retrying…");
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Start/stop polling ───────────────────────────────────────────────────────
  function startPolling() {
    if (intervalRef.current) return; // already running
    intervalRef.current = setInterval(fetchLeaderboard, LEADERBOARD_POLL_MS);
  }
  function stopPolling() {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }

  useEffect(() => {
    // Initial fetch
    fetchLeaderboard();
    startPolling();

    // Pause when tab is hidden; resume when visible
    function handleVisibility() {
      if (document.visibilityState === "visible") {
        fetchLeaderboard(); // immediate refresh on return
        startPolling();
      } else {
        stopPolling();
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      stopPolling(); // clean up on unmount — no leaks
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchLeaderboard]);

  // ── Render helpers ───────────────────────────────────────────────────────────
  const myRankInTop100 = myEntry
    ? top100.findIndex((r) => r.name === myEntry.name) >= 0
    : false;

  function rankLabel(rank: number) {
    if (rank === 1) return "🥇";
    if (rank === 2) return "🥈";
    if (rank === 3) return "🥉";
    return `#${rank}`;
  }

  function rowClass(rank: number): string {
    const isMe = myEntry && top100[rank - 1]?.name === myEntry.name;
    if (rank === 1) return "lb-row rank-1";
    if (rank === 2) return "lb-row rank-2";
    if (rank === 3) return "lb-row rank-3";
    if (isMe)       return "lb-row lb-mine";
    return "lb-row";
  }

  return (
    <div className="leaderboard-page fade-in">
      {/* Header */}
      <div className="flex justify-between items-center mb-16">
        <h1 className="display" style={{ fontSize: "1.8rem" }}>
          🏆 Leaderboard
        </h1>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 }}>
          <button
            id="btn-refresh-leaderboard"
            className="btn btn-secondary btn-sm"
            onClick={fetchLeaderboard}
          >
            ↻ Refresh
          </button>
          {lastUpdate && (
            <div className="text-xs text-muted">
              Updated {lastUpdate.toLocaleTimeString()}
            </div>
          )}
          <div className="text-xs text-muted" style={{ opacity: 0.5 }}>
            Auto-refreshes every 12s
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div
          style={{
            background: "rgba(248,113,113,0.1)",
            border: "1px solid #f87171",
            borderRadius: 8,
            padding: "10px 16px",
            marginBottom: 16,
            fontSize: "0.85rem",
            color: "#f87171",
          }}
        >
          {error}
        </div>
      )}

      {/* Loading skeletons */}
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} className="skeleton" style={{ height: 48 }} />
          ))}
        </div>
      ) : top100.length === 0 ? (
        <div className="card text-center" style={{ padding: 48, color: "var(--text-secondary)" }}>
          No players yet. Be the first to play! 🎮
        </div>
      ) : (
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Player</th>
              <th style={{ textAlign: "right" }}>Points</th>
            </tr>
          </thead>
          <tbody>
            {top100.map((row) => {
              const isMe = myEntry && row.name === myEntry.name;
              return (
                <tr key={row.rank} className={rowClass(row.rank)}>
                  <td className="rank-cell">{rankLabel(row.rank)}</td>
                  <td style={{ fontWeight: 500 }}>
                    {row.name}
                    {isMe && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: "0.7rem",
                          background: "var(--color-x)",
                          color: "#fff",
                          borderRadius: 4,
                          padding: "1px 6px",
                          verticalAlign: "middle",
                        }}
                      >
                        YOU
                      </span>
                    )}
                  </td>
                  <td className="pts-cell">{row.points}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ── Pinned "You" row when outside top 100 ─────────────────────────── */}
      {!loading && myEntry && !myRankInTop100 && (
        <div
          style={{
            marginTop: 16,
            padding: "12px 20px",
            background: "rgba(139,92,246,0.12)",
            border: "1px solid var(--color-x)",
            borderRadius: 10,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
            Your rank
          </span>
          <span style={{ fontWeight: 700, color: "var(--color-x)", fontSize: "1.1rem" }}>
            #{myEntry.rank}
          </span>
          <span style={{ flex: 1, fontWeight: 500 }}>{myEntry.name}</span>
          <span className="pts-cell">{myEntry.points} pts</span>
        </div>
      )}
    </div>
  );
}
