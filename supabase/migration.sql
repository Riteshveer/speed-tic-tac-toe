-- ─── Speed Tic-Tac-Toe: Supabase Migration ───────────────────────────────────
-- Run this in the Supabase SQL Editor (Dashboard -> SQL Editor -> New query).
-- Uses Supabase Postgres with Row Level Security.

-- ─── Enable UUID extension ────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── Players table ────────────────────────────────────────────────────────────
create table if not exists public.players (
  id          text        primary key,      -- Supabase anon user UUID
  name        text        not null,
  points      integer     not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─── Index for leaderboard query ──────────────────────────────────────────────
create index if not exists players_points_idx on public.players (points desc);

-- ─── Row Level Security ───────────────────────────────────────────────────────
alter table public.players enable row level security;

-- Anyone can read the leaderboard
create policy "public_read" on public.players
  for select using (true);

-- Players can only update their own row (name column only)
-- Points are updated by server via service-role key (bypasses RLS)
create policy "self_update" on public.players
  for update using (auth.uid()::text = id)
  with check (auth.uid()::text = id);

-- ─── Atomic increment stored procedure ───────────────────────────────────────
-- Called by the server with service-role credentials.
create or replace function public.increment_points(player_id text, delta integer)
returns void
language plpgsql
security definer
as $$
begin
  insert into public.players (id, name, points)
    values (player_id, 'Unknown', delta)
    on conflict (id)
    do update set
      points = players.points + excluded.points,
      updated_at = now();
end;
$$;

-- ─── Auto-update updated_at ───────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger players_updated_at
  before update on public.players
  for each row execute function public.set_updated_at();
