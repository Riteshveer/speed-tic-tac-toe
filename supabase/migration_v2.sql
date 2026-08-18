-- ─── Migration v2: Google OAuth, unique usernames, RLS, indexes, rank RPC ─────
-- Run this in the Supabase SQL Editor AFTER the original migration.sql

-- 1. Add username_set flag so we know if a user has chosen their username
ALTER TABLE players ADD COLUMN IF NOT EXISTS username_set boolean NOT NULL DEFAULT false;

-- 2. Rename name → username for clarity (safe: just an alias approach via index)
--    We keep the column named "name" for backward compat but enforce uniqueness
--    on lower(name) via a partial unique index.
CREATE UNIQUE INDEX IF NOT EXISTS players_lower_name_unique
  ON players (lower(name));

-- 3. Fast leaderboard query: index on points DESC, name ASC for stable tie-break
CREATE INDEX IF NOT EXISTS players_points_desc_idx
  ON players (points DESC, name ASC);

-- 4. Stable tie-break: add created_at to index for players with equal points
--    (earlier account = higher rank)
DROP INDEX IF EXISTS players_points_desc_idx;
CREATE INDEX IF NOT EXISTS players_points_desc_idx
  ON players (points DESC, created_at ASC);

-- 5. Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Anyone can read (public leaderboard)
DROP POLICY IF EXISTS "public_read" ON players;
CREATE POLICY "public_read" ON players
  FOR SELECT USING (true);

-- Authenticated users can update ONLY their own username (not points)
DROP POLICY IF EXISTS "own_username_update" ON players;
CREATE POLICY "own_username_update" ON players
  FOR UPDATE
  USING (auth.uid()::text = id)
  WITH CHECK (auth.uid()::text = id);

-- Points are written ONLY by the server via service-role key (bypasses RLS)
-- No INSERT policy for clients; the service role bypasses RLS entirely.

-- 6. Updated increment_points RPC (replace if exists) ─────────────────────────
CREATE OR REPLACE FUNCTION increment_points(player_id text, delta integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER  -- runs as owner (service role), bypasses RLS
AS $$
BEGIN
  INSERT INTO players (id, name, points, created_at, updated_at)
    VALUES (player_id, 'Player', delta, now(), now())
  ON CONFLICT (id) DO UPDATE
    SET points     = players.points + EXCLUDED.points,
        updated_at = now();
END;
$$;

-- 7. get_player_rank RPC: count how many players have strictly more points ──────
CREATE OR REPLACE FUNCTION get_player_rank(player_id text)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  my_points integer;
  rank_val  integer;
BEGIN
  SELECT points INTO my_points FROM players WHERE id = player_id;
  IF my_points IS NULL THEN RETURN NULL; END IF;
  SELECT COUNT(*) + 1 INTO rank_val FROM players WHERE points > my_points;
  RETURN rank_val;
END;
$$;

-- 8. check_username_available RPC ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_username_available(username_candidate text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM players WHERE lower(name) = lower(trim(username_candidate))
  );
END;
$$;
