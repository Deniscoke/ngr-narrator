-- ============================================================
-- RPG Narrator Engine — Supabase SQL Schema
-- Run this in Supabase SQL editor when ready to enable persistence
-- ============================================================

-- Campaigns
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  ruleset_id text default 'generic',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Sessions
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  title text not null,
  summary text default '',
  date date default current_date,
  "order" int default 0,
  created_at timestamptz default now()
);

-- Characters
create table if not exists characters (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  name text not null,
  race text default '',
  class text default '',
  level int default 1,
  stats jsonb default '{}',
  notes text default '',
  is_npc boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Memory entries (notes, events, lore, quests)
create table if not exists memory_entries (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references campaigns(id) on delete cascade,
  session_id uuid references sessions(id) on delete set null,
  type text check (type in ('note', 'event', 'lore', 'quest')) default 'note',
  title text not null,
  content text default '',
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Rules chunks (future use — rules ingestion pipeline)
create table if not exists rules_chunks (
  id uuid primary key default gen_random_uuid(),
  ruleset_id text not null,
  source text default '',
  content text not null,
  embedding vector(1536),  -- requires pgvector extension
  tags text[] default '{}',
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_sessions_campaign on sessions(campaign_id);
create index if not exists idx_characters_campaign on characters(campaign_id);
create index if not exists idx_memory_campaign on memory_entries(campaign_id);
create index if not exists idx_rules_ruleset on rules_chunks(ruleset_id);

-- RLS policies (enable when needed)
-- alter table campaigns enable row level security;
-- alter table sessions enable row level security;
-- alter table characters enable row level security;
-- alter table memory_entries enable row level security;
-- alter table rules_chunks enable row level security;
