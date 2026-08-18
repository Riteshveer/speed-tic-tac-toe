// ─── Searching Screen ─────────────────────────────────────────────────────────
import { useEffect, useState } from "react";

interface SearchingProps {
  onCancel: () => void;
}

export default function Searching({ onCancel }: SearchingProps) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, []);

  const mins = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const secs = String(elapsed % 60).padStart(2, "0");

  return (
    <div
      style={{
        minHeight: "60vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "40px 24px",
      }}
    >
      <div className="searching fade-in">
        <div className="search-spinner" />
        <div>
          <h2 className="display" style={{ fontSize: "1.5rem", textAlign: "center" }}>
            Finding Opponent…
          </h2>
          <p className="text-muted text-center mt-8" style={{ fontSize: "0.9rem" }}>
            Matching you within ±20 points
          </p>
        </div>
        <div className="search-timer">{mins}:{secs}</div>
        <p className="text-muted" style={{ fontSize: "0.8rem", textAlign: "center" }}>
          {elapsed < 90
            ? `Auto-match in ${90 - elapsed}s if no one found`
            : "Matching you with a challenger…"}
        </p>
        <button
          id="btn-cancel-search"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          ✕ Cancel
        </button>
      </div>
    </div>
  );
}
