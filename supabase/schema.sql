-- Illusions: one row per Discord user. Cookie is ciphertext only.
-- Paste this in Supabase → SQL Editor. Keep the table private (RLS on, no anon policies).

create table if not exists public.illusions_users (
  discord_id text primary key,
  discord_name text,
  discord_avatar text,
  roblox_user_id bigint,
  roblox_username text,
  roblox_display_name text,
  cookie_blob text,
  ops jsonb not null default '{"sessionUploads":0,"failed":0,"moderated":0}'::jsonb,
  connected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.illusions_users enable row level security;

revoke all on public.illusions_users from anon, authenticated;
