// ─── Client-side game utilities ───────────────────────────────────────────────
// Mirror of server logic for display purposes only (never used for validation).

import { Mode } from "@shared/types";

export function getTimeLimit(mode: Mode, playerMoveCount: number): number {
  if (mode === "classic") return 7;
  return Math.max(3, 7 - Math.floor(playerMoveCount / 3));
}
