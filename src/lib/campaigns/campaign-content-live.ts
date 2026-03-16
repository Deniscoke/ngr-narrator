// ============================================================
// Live party room — Supabase campaign content + Realtime
// ============================================================

import { createClient } from "@/lib/supabase/client";
import type {
  NarrationEntry,
  Character,
  Session,
  CampaignState,
  MemoryEntry,
  NarrationConsequences,
} from "@/types";

// ---- Mappers Supabase ↔ App types ----

function mapNarration(row: {
  id: string;
  campaign_id: string;
  mode: string;
  user_input: string;
  narration_text: string;
  suggested_actions: string[] | null;
  consequences: unknown;
  created_at: string;
}): NarrationEntry {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    mode: (row.mode === "mock" ? "mock" : "ai") as "mock" | "ai",
    userInput: row.user_input,
    narrationText: row.narration_text,
    suggestedActions: row.suggested_actions ?? [],
    consequences: row.consequences as NarrationConsequences | undefined,
    createdAt: row.created_at,
  };
}

function mapCharacter(row: Record<string, unknown>): Character {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    name: (row.name as string) ?? "",
    race: (row.race as string) ?? "",
    class: (row.class as string) ?? "",
    specialization: row.specialization as string | undefined,
    gender: row.gender as string | undefined,
    level: (row.level as number) ?? 1,
    hp: row.hp as number | undefined,
    maxHp: row.max_hp as number | undefined,
    xp: row.xp as number | undefined,
    stats: (row.stats as Record<string, number>) ?? {},
    statuses: (row.statuses as string[]) ?? [],
    injuries: (row.injuries as string[]) ?? [],
    inventory: (row.inventory as string[]) ?? [],
    notes: (row.notes as string) ?? "",
    isNPC: !!row.is_npc,
    portraitUrl: row.portrait_url as string | undefined,
    createdAt: (row.created_at as string) ?? "",
    updatedAt: (row.updated_at as string) ?? "",
  };
}

function mapSession(row: {
  id: string;
  campaign_id: string;
  title: string;
  summary: string;
  date: string;
  order: number;
  created_at: string;
}): Session {
  return {
    id: row.id,
    campaignId: row.campaign_id,
    title: row.title,
    summary: row.summary,
    date: row.date,
    order: row.order,
    createdAt: row.created_at,
  };
}

// ---- CRUD ----

export async function fetchNarrations(campaignId: string): Promise<NarrationEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("narrations")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapNarration);
}

export async function insertNarration(entry: Omit<NarrationEntry, "id" | "createdAt">): Promise<NarrationEntry | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("narrations")
    .insert({
      campaign_id: entry.campaignId,
      mode: entry.mode,
      user_input: entry.userInput,
      narration_text: entry.narrationText,
      suggested_actions: entry.suggestedActions ?? [],
      consequences: entry.consequences ?? null,
    })
    .select()
    .single();
  if (error) return null;
  return mapNarration(data);
}

export async function fetchCharacters(campaignId: string): Promise<Character[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("name");
  if (error) throw error;
  return (data ?? []).map((r) => mapCharacter(r as Record<string, unknown>));
}

export async function upsertCharacter(char: Partial<Character> & { campaignId: string; name: string }): Promise<Character | null> {
  const supabase = createClient();
  const row = {
    id: char.id,
    campaign_id: char.campaignId,
    name: char.name,
    race: char.race ?? "",
    class: char.class ?? "",
    specialization: char.specialization ?? null,
    gender: char.gender ?? null,
    level: char.level ?? 1,
    hp: char.hp ?? null,
    max_hp: char.maxHp ?? null,
    xp: char.xp ?? null,
    stats: char.stats ?? {},
    statuses: char.statuses ?? [],
    injuries: char.injuries ?? [],
    inventory: char.inventory ?? [],
    notes: char.notes ?? "",
    is_npc: char.isNPC ?? false,
    portrait_url: char.portraitUrl ?? null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await supabase.from("characters").upsert(row, { onConflict: "id" }).select().single();
  if (error) return null;
  return mapCharacter(data as Record<string, unknown>);
}

export async function insertCharacter(char: Omit<Character, "id" | "createdAt" | "updatedAt">): Promise<Character | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("characters")
    .insert({
      campaign_id: char.campaignId,
      name: char.name,
      race: char.race ?? "",
      class: char.class ?? "",
      specialization: char.specialization ?? null,
      gender: char.gender ?? null,
      level: char.level ?? 1,
      hp: char.hp ?? null,
      max_hp: char.maxHp ?? null,
      xp: char.xp ?? null,
      stats: char.stats ?? {},
      statuses: char.statuses ?? [],
      injuries: char.injuries ?? [],
      inventory: char.inventory ?? [],
      notes: char.notes ?? "",
      is_npc: char.isNPC ?? false,
      portrait_url: char.portraitUrl ?? null,
    })
    .select()
    .single();
  if (error) return null;
  return mapCharacter(data as Record<string, unknown>);
}

export async function updateCharacter(id: string, updates: Partial<Character>): Promise<Character | null> {
  const supabase = createClient();
  const row: Record<string, unknown> = {};
  if (updates.name !== undefined) row.name = updates.name;
  if (updates.race !== undefined) row.race = updates.race;
  if (updates.class !== undefined) row.class = updates.class;
  if (updates.level !== undefined) row.level = updates.level;
  if (updates.hp !== undefined) row.hp = updates.hp;
  if (updates.maxHp !== undefined) row.max_hp = updates.maxHp;
  if (updates.xp !== undefined) row.xp = updates.xp;
  if (updates.stats !== undefined) row.stats = updates.stats;
  if (updates.statuses !== undefined) row.statuses = updates.statuses;
  if (updates.injuries !== undefined) row.injuries = updates.injuries;
  if (updates.inventory !== undefined) row.inventory = updates.inventory;
  if (updates.notes !== undefined) row.notes = updates.notes;
  if (updates.isNPC !== undefined) row.is_npc = updates.isNPC;
  row.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from("characters").update(row).eq("id", id).select().single();
  if (error) return null;
  return mapCharacter(data as Record<string, unknown>);
}

export async function deleteCharacter(id: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("characters").delete().eq("id", id);
  return !error;
}

export async function fetchSessions(campaignId: string): Promise<Session[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("order");
  if (error) return [];
  return (data ?? []).map(mapSession);
}

export async function insertSession(s: Omit<Session, "id" | "createdAt">): Promise<Session | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("sessions")
    .insert({
      campaign_id: s.campaignId,
      title: s.title,
      summary: s.summary ?? "",
      date: s.date,
      order: s.order ?? 0,
    })
    .select()
    .single();
  if (error) return null;
  return mapSession(data);
}

/** Načíta kampaň podľa ID — RLS zaistí prístup len pre členov.
 *  Nikdy nevracia password_hash ani password_salt. */
export async function fetchCampaign(campaignId: string): Promise<import("@/types").Campaign | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("campaigns")
    .select("id, name, description, ruleset_id, memory_summary, house_rules, rules_pack_text, password_hash, created_at, updated_at")
    .eq("id", campaignId)
    .single();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    description: data.description ?? "",
    rulesetId: data.ruleset_id ?? "generic",
    memorySummary: data.memory_summary ?? undefined,
    houseRules: data.house_rules ?? undefined,
    rulesPackText: data.rules_pack_text ?? undefined,
    hasPassword: !!(data as Record<string, unknown>).password_hash,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

/** Aktualizuje memory_summary kampane po narrácii */
export async function updateCampaignMemory(campaignId: string, memorySummary: string): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("campaigns")
    .update({ memory_summary: memorySummary, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
}

/** Skontroluje, či je používateľ členom kampane (Supabase) */
export async function isCampaignMember(campaignId: string, userId: string): Promise<boolean> {
  const supabase = createClient();
  const { data } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("user_id", userId)
    .single();
  return !!data;
}
