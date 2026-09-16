-- Loopboard schema for Supabase (PostgreSQL).
-- Run this once in the Supabase dashboard → SQL Editor → New query → Run.

create table if not exists users (
  id            text primary key,
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  avatar_color  text not null,
  created_at    bigint not null
);

create table if not exists sessions (
  token      text primary key,
  user_id    text not null references users(id) on delete cascade,
  created_at bigint not null,
  expires_at bigint not null
);

create table if not exists teams (
  id          text primary key,
  name        text not null,
  invite_code text not null unique,
  created_by  text not null references users(id),
  created_at  bigint not null
);

create table if not exists team_members (
  team_id   text not null references teams(id) on delete cascade,
  user_id   text not null references users(id) on delete cascade,
  role      text not null default 'member',
  joined_at bigint not null,
  primary key (team_id, user_id)
);

create table if not exists boards (
  id         text primary key,
  name       text not null,
  emoji      text not null default '🌀',
  team_id    text references teams(id) on delete cascade,
  owner_id   text not null references users(id) on delete cascade,
  created_at bigint not null,
  updated_at bigint not null
);

create table if not exists columns (
  id        text primary key,
  board_id  text not null references boards(id) on delete cascade,
  name      text not null,
  accent    text not null default 'blue',
  position  integer not null,
  wip_limit integer
);

create table if not exists cards (
  id          text primary key,
  board_id    text not null references boards(id) on delete cascade,
  column_id   text not null references columns(id) on delete cascade,
  title       text not null,
  description text not null default '',
  priority    text not null default 'none',
  labels      text not null default '[]',
  assignee_id text references users(id) on delete set null,
  due_date    text,
  position    integer not null,
  created_by  text not null references users(id),
  created_at  bigint not null,
  updated_at  bigint not null
);

-- Supabase pauses a free-tier project after ~7 days with no activity. A daily
-- cron hits the database and records the result here, which both keeps the
-- project awake and gives the admin panel something to show.
create table if not exists keepalive_runs (
  id     text primary key,
  ran_at bigint not null,
  ok     boolean not null,
  source text not null,          -- 'cron' or 'manual'
  detail text
);

create index if not exists idx_keepalive_ran_at on keepalive_runs(ran_at desc);

create index if not exists idx_cards_board    on cards(board_id);
create index if not exists idx_cards_column   on cards(column_id, position);
create index if not exists idx_columns_board  on columns(board_id, position);
create index if not exists idx_boards_team    on boards(team_id);
create index if not exists idx_sessions_user  on sessions(user_id);
create index if not exists idx_sessions_exp   on sessions(expires_at);

-- Security note: Supabase auto-exposes the `public` schema over its REST API to
-- anyone holding the anon key. Loopboard does NOT use that API — the server
-- connects directly over Postgres as the `postgres` role, which bypasses RLS.
-- Enabling RLS with zero policies therefore locks out the public REST API
-- completely while leaving our server unaffected. Do not add policies here
-- unless you intend to expose that data to the browser.
alter table users        enable row level security;
alter table sessions     enable row level security;
alter table teams        enable row level security;
alter table team_members enable row level security;
alter table boards       enable row level security;
alter table columns      enable row level security;
alter table cards        enable row level security;
alter table keepalive_runs enable row level security;
