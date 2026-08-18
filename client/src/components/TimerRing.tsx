// ─── Timer Ring Component ─────────────────────────────────────────────────────
// Purely display — synced to server deadline epoch ms.

import { useEffect, useRef, useState } from "react";

interface TimerRingProps {
  deadlineMs: number;    // epoch ms
  totalSec: number;      // max seconds (for full ring)
  player: "X" | "O";
  isMyTurn: boolean;
}

const R = 28; // SVG circle radius
const CIRC = 2 * Math.PI * R; // circumference

export default function TimerRing({
  deadlineMs,
  totalSec,
  player,
  isMyTurn,
}: TimerRingProps) {
  const [remaining, setRemaining] = useState(totalSec);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    function tick() {
      const now = Date.now();
      const secs = Math.max(0, (deadlineMs - now) / 1000);
      setRemaining(secs);
      if (secs > 0) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [deadlineMs]);

  const fraction = Math.min(1, Math.max(0, remaining / totalSec));
  const offset = CIRC * (1 - fraction);

  const isLow = remaining < 3;
  const color =
    isLow
      ? "#ff4444"
      : player === "X"
      ? "var(--accent-x)"
      : "var(--accent-o)";

  return (
    <div className="timer-ring-container">
      <svg viewBox="0 0 64 64" width="64" height="64">
        <circle
          className="timer-ring-bg"
          cx="32"
          cy="32"
          r={R}
          strokeWidth="5"
          fill="none"
        />
        <circle
          className="timer-ring-fg"
          cx="32"
          cy="32"
          r={R}
          strokeWidth="5"
          fill="none"
          stroke={color}
          strokeDasharray={CIRC}
          strokeDashoffset={offset}
          style={{ transition: "stroke-dashoffset 0.1s linear, stroke 0.5s" }}
        />
      </svg>
      <span
        className="timer-value"
        style={{
          color: isLow ? "#ff4444" : "var(--text-primary)",
          animation: isLow && isMyTurn ? "pulse 0.5s ease-in-out infinite" : "none",
        }}
      >
        {Math.ceil(remaining)}
      </span>
    </div>
  );
}
