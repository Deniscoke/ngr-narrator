// src/app/api/campaigns/join/route.ts
// ============================================================
// POST /api/campaigns/join — secure join by join_code
// Password is verified server-side (plaintext over HTTPS).
// Client MUST NOT send or store a password hash as credential.
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { verifyPassword } from "@/lib/security/password";

interface JoinBody {
  joinCode?: string;
  password?: string;  // plaintext — verified here, never returned
}

export async function POST(request: NextRequest) {
  let body: JoinBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Nevalidní JSON." }, { status: 400 });
  }

  const joinCode = (body.joinCode ?? "").trim().toUpperCase();
  if (!joinCode || joinCode.length < 4) {
    return NextResponse.json({ error: "Kód kampaně je povinný (min. 4 znaky)." }, { status: 400 });
  }

  // ---- Auth ----
  const supabase = await createClient();
  const { data: { user }, error: authErr } = await supabase.auth.getUser();
  if (authErr || !user) {
    return NextResponse.json({ error: "Nejsi přihlášen." }, { status: 401 });
  }

  // ---- Lookup campaign by join_code ----
  // RLS: "Authenticated can read campaigns" — any auth'd user can SELECT
  const { data: campaign, error: fetchErr } = await supabase
    .from("campaigns")
    .select("id, name, description, ruleset_id, memory_summary, house_rules, rules_pack_text, password_hash, password_salt, join_code, is_public, created_at, updated_at")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (fetchErr) {
    console.error("[join] DB fetch error:", fetchErr.message);
    return NextResponse.json({ error: "Chyba při hledání kampaně." }, { status: 500 });
  }
  if (!campaign) {
    return NextResponse.json({ error: "Kampaň s tímto kódem neexistuje." }, { status: 404 });
  }

  // ---- Password verification (server-side only) ----
  if (campaign.password_hash && campaign.password_salt) {
    const plaintext = (body.password ?? "").trim();
    if (!plaintext) {
      return NextResponse.json(
        { error: "Tato kampaň je chráněna heslem.", requiresPassword: true },
        { status: 403 }
      );
    }
    const valid = await verifyPassword(plaintext, campaign.password_hash, campaign.password_salt);
    if (!valid) {
      return NextResponse.json({ error: "Nesprávné heslo." }, { status: 403 });
    }
  }

  // ---- Insert membership (idempotent) ----
  const { error: memberErr } = await supabase
    .from("campaign_members")
    .insert({ user_id: user.id, campaign_id: campaign.id, role: "member" })
    .select()
    .single();

  // 23505 = unique_violation (already member) — treat as success
  if (memberErr && memberErr.code !== "23505") {
    console.error("[join] membership insert error:", memberErr.message);
    return NextResponse.json({ error: "Nepodařilo se připojit ke kampani." }, { status: 500 });
  }

  // ---- Return campaign (without sensitive fields) ----
  return NextResponse.json({
    ok: true,
    campaign: {
      id: campaign.id,
      name: campaign.name,
      description: campaign.description ?? "",
      rulesetId: campaign.ruleset_id ?? "generic",
      joinCode: campaign.join_code,
      memorySummary: campaign.memory_summary ?? undefined,
      houseRules: campaign.house_rules ?? undefined,
      rulesPackText: campaign.rules_pack_text ?? undefined,
      hasPassword: !!(campaign.password_hash),
      createdAt: campaign.created_at,
      updatedAt: campaign.updated_at,
    },
  });
}
