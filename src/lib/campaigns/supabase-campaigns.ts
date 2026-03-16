// ============================================================
// Campaign membership — Supabase campaigns + campaign_members
// ============================================================

import { createClient } from "@/lib/supabase/client";
import type { Campaign } from "@/types";

export type CampaignMemberRole = "owner" | "member";

export interface CampaignMember {
  id: string;
  userId: string;
  campaignId: string;
  role: CampaignMemberRole;
  createdAt: string;
}

export interface CampaignWithRole extends Campaign {
  role?: CampaignMemberRole;
}

function supabaseCampaignToCampaign(row: {
  id: string;
  name: string;
  description: string | null;
  ruleset_id: string;
  memory_summary: string | null;
  house_rules: string | null;
  rules_pack_text: string | null;
  password_hash: string | null;
  password_salt: string | null;
  join_code?: string | null;
  is_public?: boolean | null;
  created_at: string;
  updated_at: string;
}): Campaign {
  // SECURITY: Never expose password_hash or password_salt to clients.
  // Use hasPassword (bool) to indicate whether a join-password is set.
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? "",
    rulesetId: row.ruleset_id,
    memorySummary: row.memory_summary ?? undefined,
    houseRules: row.house_rules ?? undefined,
    rulesPackText: row.rules_pack_text ?? undefined,
    joinCode: row.join_code ?? undefined,
    hasPassword: !!row.password_hash,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Získa všetky kampane, v ktorých je používateľ členom */
export async function getMyCampaigns(userId: string): Promise<CampaignWithRole[]> {
  const supabase = createClient();

  const { data: members, error: memErr } = await supabase
    .from("campaign_members")
    .select("campaign_id, role")
    .eq("user_id", userId);

  if (memErr || !members?.length) return [];

  const campaignIds = members.map((m) => m.campaign_id);
  const { data: campaigns, error } = await supabase
    .from("campaigns")
    .select("*")
    .in("id", campaignIds);

  if (error || !campaigns) return [];

  const roleMap = new Map(members.map((m) => [m.campaign_id, m.role as CampaignMemberRole]));
  return campaigns.map((c) => ({
    ...supabaseCampaignToCampaign({
      id: c.id,
      name: c.name,
      description: c.description,
      ruleset_id: c.ruleset_id ?? "generic",
      memory_summary: c.memory_summary,
      house_rules: c.house_rules,
      rules_pack_text: c.rules_pack_text,
      password_hash: c.password_hash,
      password_salt: c.password_salt,
      join_code: c.join_code ?? null,
      is_public: c.is_public ?? null,
      created_at: c.created_at,
      updated_at: c.updated_at,
    }),
    role: roleMap.get(c.id),
  }));
}

/** Vytvorí kampaň a pridá tvorcu ako ownera */
export async function createCampaign(
  userId: string,
  input: { name: string; description?: string; passwordHash?: string; passwordSalt?: string }
): Promise<Campaign | null> {
  const supabase = createClient();

  const { data: campaign, error: createErr } = await supabase
    .from("campaigns")
    .insert({
      name: input.name.trim(),
      description: (input.description ?? "").trim(),
      ruleset_id: "generic",
      created_by: userId,
      password_hash: input.passwordHash ?? null,
      password_salt: input.passwordSalt ?? null,
    })
    .select()
    .single();

  if (createErr || !campaign) return null;

  const { error: memberErr } = await supabase.from("campaign_members").insert({
    user_id: userId,
    campaign_id: campaign.id,
    role: "owner",
  });

  if (memberErr) {
    // Rollback: delete campaign
    await supabase.from("campaigns").delete().eq("id", campaign.id);
    return null;
  }

  return supabaseCampaignToCampaign({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    ruleset_id: campaign.ruleset_id,
    memory_summary: campaign.memory_summary,
    house_rules: campaign.house_rules,
    rules_pack_text: campaign.rules_pack_text,
    password_hash: campaign.password_hash,
    password_salt: campaign.password_salt,
    join_code: campaign.join_code ?? null,
    is_public: campaign.is_public ?? null,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  });
}

/** Pripojí používateľa ku kampani */
export async function joinCampaign(userId: string, campaignId: string): Promise<{ ok: true; campaign: Campaign } | { ok: false; error: string }> {
  const supabase = createClient();

  // Skontroluj, či kampaň existuje
  const { data: campaign, error: fetchErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (fetchErr || !campaign) {
    return { ok: false, error: "Kampaň neexistuje alebo kód je nesprávny." };
  }

  // Skontroluj, či už nie som člen
  const { data: existing } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .single();

  if (existing) {
    return {
      ok: true,
      campaign: supabaseCampaignToCampaign({
        id: campaign.id,
        name: campaign.name,
        description: campaign.description,
        ruleset_id: campaign.ruleset_id,
        memory_summary: campaign.memory_summary,
        house_rules: campaign.house_rules,
        rules_pack_text: campaign.rules_pack_text,
        password_hash: campaign.password_hash,
        password_salt: campaign.password_salt,
        created_at: campaign.created_at,
        updated_at: campaign.updated_at,
      }),
    };
  }

  const { error: memberErr } = await supabase.from("campaign_members").insert({
    user_id: userId,
    campaign_id: campaignId,
    role: "member",
  });

  if (memberErr) {
    return { ok: false, error: "Nepodařilo se připojit ke kampani." };
  }

  return {
    ok: true,
    campaign: supabaseCampaignToCampaign({
      id: campaign.id,
      name: campaign.name,
      description: campaign.description,
      ruleset_id: campaign.ruleset_id,
      memory_summary: campaign.memory_summary,
      house_rules: campaign.house_rules,
      rules_pack_text: campaign.rules_pack_text,
      password_hash: campaign.password_hash,
      password_salt: campaign.password_salt,
      created_at: campaign.created_at,
      updated_at: campaign.updated_at,
    }),
  };
}

/**
 * Join a campaign by its short 6-char join_code.
 * Password verification happens in POST /api/campaigns/join — call that route
 * for password-protected campaigns. This function handles the DB join only
 * (used by the API route after password is verified).
 */
export async function joinCampaignByCode(
  joinCode: string,
  _userId: string // kept for API compat; server Supabase client uses JWT
): Promise<{ ok: true; campaign: Campaign } | { ok: false; error: string }> {
  const supabase = createClient();

  const code = joinCode.trim().toUpperCase();

  // RLS: "Authenticated can read campaigns" allows SELECT for any auth'd user
  const { data: campaign, error: fetchErr } = await supabase
    .from("campaigns")
    .select("*")
    .eq("join_code", code)
    .maybeSingle();

  if (fetchErr || !campaign) {
    return { ok: false, error: "Kampaň s tímto kódem neexistuje." };
  }

  // Check if already member
  const { data: { user } } = await supabase.auth.getUser();
  const uid = user?.id ?? "";

  const { data: existing } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("user_id", uid)
    .eq("campaign_id", campaign.id)
    .maybeSingle();

  if (existing) {
    return {
      ok: true,
      campaign: supabaseCampaignToCampaign({
        ...campaign,
        join_code: campaign.join_code ?? null,
        is_public: campaign.is_public ?? null,
      }),
    };
  }

  // Insert membership
  const { error: memberErr } = await supabase.from("campaign_members").insert({
    user_id: uid,
    campaign_id: campaign.id,
    role: "member",
  });

  if (memberErr) {
    return { ok: false, error: "Nepodařilo se připojit ke kampani." };
  }

  return {
    ok: true,
    campaign: supabaseCampaignToCampaign({
      ...campaign,
      join_code: campaign.join_code ?? null,
      is_public: campaign.is_public ?? null,
    }),
  };
}

/** Získa jednu kampaň podľa ID (ak je používateľ členom) */
export async function getCampaignById(campaignId: string, userId: string): Promise<Campaign | null> {
  const supabase = createClient();

  const { data: member } = await supabase
    .from("campaign_members")
    .select("id")
    .eq("user_id", userId)
    .eq("campaign_id", campaignId)
    .single();

  if (!member) return null;

  const { data: campaign, error } = await supabase
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .single();

  if (error || !campaign) return null;

  return supabaseCampaignToCampaign({
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    ruleset_id: campaign.ruleset_id,
    memory_summary: campaign.memory_summary,
    house_rules: campaign.house_rules,
    rules_pack_text: campaign.rules_pack_text,
    password_hash: campaign.password_hash,
    password_salt: campaign.password_salt,
    join_code: campaign.join_code ?? null,
    is_public: campaign.is_public ?? null,
    created_at: campaign.created_at,
    updated_at: campaign.updated_at,
  });
}
