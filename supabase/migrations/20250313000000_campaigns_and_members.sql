-- ============================================================
-- Kampane a členstvo — každý hráč má svoje kampane v profile
-- ============================================================

-- Kampane (ak ešte neexistujú)
create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text default '',
  ruleset_id text default 'generic',
  memory_summary text,
  house_rules text,
  rules_pack_text text,
  password_hash text,
  password_salt text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Členovia kampaní — kto v ktorej kampani je (vlastník aj členovia)
create table if not exists campaign_members (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references campaigns(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  created_at timestamptz default now(),
  unique(campaign_id, user_id)
);

create index if not exists idx_campaign_members_user on campaign_members(user_id);
create index if not exists idx_campaign_members_campaign on campaign_members(campaign_id);
create index if not exists idx_campaigns_created_by on campaigns(created_by);

-- RLS pre campaigns
alter table campaigns enable row level security;

drop policy if exists "Campaigns readable by members" on campaigns;
drop policy if exists "Authenticated can read campaigns" on campaigns;
-- Prihlásení môžu čítať kampaně (kvôli join flow + zoznamu svojich kampaní)
create policy "Authenticated can read campaigns"
  on campaigns for select
  using (auth.role() = 'authenticated');

drop policy if exists "Owners can insert campaigns" on campaigns;
create policy "Owners can insert campaigns"
  on campaigns for insert
  with check (auth.uid() = created_by);

drop policy if exists "Members can update campaign" on campaigns;
create policy "Members can update campaign"
  on campaigns for update
  using (
    auth.uid() in (
      select user_id from campaign_members where campaign_id = campaigns.id and role in ('owner', 'member')
    )
  );

drop policy if exists "Owners can delete campaign" on campaigns;
create policy "Owners can delete campaign"
  on campaigns for delete
  using (auth.uid() = created_by);

-- RLS pre campaign_members
alter table campaign_members enable row level security;

drop policy if exists "Members see own memberships" on campaign_members;
create policy "Members see own memberships"
  on campaign_members for select
  using (
    auth.uid() = user_id
    or auth.uid() in (select user_id from campaign_members cm where cm.campaign_id = campaign_members.campaign_id)
  );

drop policy if exists "Owners can add members" on campaign_members;
create policy "Owners can add members"
  on campaign_members for insert
  with check (
    auth.uid() = user_id
    or exists (
      select 1 from campaign_members cm
      where cm.campaign_id = campaign_members.campaign_id and cm.user_id = auth.uid() and cm.role = 'owner'
    )
  );

drop policy if exists "Users can leave campaign" on campaign_members;
create policy "Users can leave campaign"
  on campaign_members for delete
  using (auth.uid() = user_id);

-- Funkcia na pripojenie sa ku kampani (obchádza RLS — kampaň ešte nemôže byť viditeľná)
create or replace function public.join_campaign(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
  v_campaign campaigns%rowtype;
  v_exists boolean;
begin
  if v_user_id is null then
    return jsonb_build_object('ok', false, 'error', 'Nie si prihlásený.');
  end if;

  select exists(select 1 from campaigns where id = p_campaign_id) into v_exists;
  if not v_exists then
    return jsonb_build_object('ok', false, 'error', 'Kampaň neexistuje.');
  end if;

  insert into campaign_members (user_id, campaign_id, role)
  values (v_user_id, p_campaign_id, 'member')
  on conflict (campaign_id, user_id) do nothing;

  select * into v_campaign from campaigns where id = p_campaign_id;
  return jsonb_build_object(
    'ok', true,
    'campaign', jsonb_build_object(
      'id', v_campaign.id,
      'name', v_campaign.name,
      'description', coalesce(v_campaign.description, ''),
      'rulesetId', coalesce(v_campaign.ruleset_id, 'generic'),
      'createdAt', v_campaign.created_at,
      'updatedAt', v_campaign.updated_at
    )
  );
end;
$$;

grant execute on function public.join_campaign(uuid) to authenticated;
