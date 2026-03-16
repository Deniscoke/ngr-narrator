// ============================================================
// POST /api/narrate — narration endpoint using provider pattern
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { LocalProvider } from "@/lib/ai/local-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import type { NarrationRequest, NarrationProvider, CompactNarrationEntry, CharacterSnapshot, EventLogEntry } from "@/lib/ai/provider";

// ---- Supabase server client — lazy, dynamic (requires next/headers) ----
async function loadServerSupabase() {
  try {
    const { createClient } = await import("@/lib/supabase/server");
    return await createClient();
  } catch {
    return null;
  }
}

// ---- Request body — tolerant shape ----
interface DiceRollRecord {
  diceType: "d6" | "d20";
  result: number;
  isCritical: boolean;
  isBonusRoll: boolean;
}

interface RequestBody {
  prompt?: string;
  userInput?: string; // alias for prompt
  campaignId?: string;
  mode?: "local" | "ai";
  // Campaign context sent from client
  campaignTitle?: string;
  campaignDescription?: string;
  memorySummary?: string;
  houseRules?: string;
  rulesPackText?: string;
  // Optional recent entries from client-side localStorage
  recentEntries?: CompactNarrationEntry[];
  // Characters snapshot from client
  characters?: CharacterSnapshot[];
  // Dice rolls this turn — validated server-side
  diceRolls?: DiceRollRecord[];
  // Language — accept any of these
  lang?: string;
  language?: string;
  locale?: string;
}

// ---- Dice roll sequence validation ----
// Rule: a bonus roll (isBonusRoll=true) is only valid if preceded by a
// critical first roll (isCritical=true, isBonusRoll=false).
// This cannot be enforced purely in the UI (DevTools can fabricate requests).
function validateDiceRolls(rolls: DiceRollRecord[]): { ok: true } | { ok: false; error: string } {
  if (!rolls.length) return { ok: true };

  const bonusRolls = rolls.filter((r) => r.isBonusRoll);
  if (bonusRolls.length === 0) return { ok: true };

  // There must be exactly one bonus roll and it must follow a critical first roll
  if (bonusRolls.length > 1) {
    return { ok: false, error: "Neplatná sekvence hodů kostkou: více bonusových hodů." };
  }

  const criticalFirstRoll = rolls.find((r) => r.isCritical && !r.isBonusRoll);
  if (!criticalFirstRoll) {
    return { ok: false, error: "Neplatná sekvence hodů kostkou: bonusový hod bez předchozího kritického hodu." };
  }

  // The bonus roll must use the same dice type as the critical
  const bonus = bonusRolls[0];
  if (bonus.diceType !== criticalFirstRoll.diceType) {
    return { ok: false, error: "Neplatná sekvence hodů kostkou: bonusový hod použil jiný typ kostky." };
  }

  // Sanity: isCritical must match actual roll value
  const criticalThreshold = criticalFirstRoll.diceType === "d6" ? 6 : 20;
  if (criticalFirstRoll.result !== criticalThreshold) {
    return { ok: false, error: "Neplatná sekvence hodů kostkou: označený kritický hod neodpovídá hodnotě." };
  }

  return { ok: true };
}

const localProvider = new LocalProvider();

// Lazily created — only when AI key is available
let openaiProvider: OpenAIProvider | null = null;

function getOpenAIProvider(): OpenAIProvider | null {
  const key   = process.env.NARRATOR_AI_API_KEY;
  const model = process.env.NARRATOR_AI_MODEL || "gpt-4o";
  if (!key) return null;
  if (!openaiProvider) openaiProvider = new OpenAIProvider(key, model);
  return openaiProvider;
}

// ---- Supabase availability check (tolerant of NEXT_PUBLIC_ prefix) ----
function getSupabaseEnv(): { url: string; key: string } | null {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (url && key) return { url, key };
  return null;
}

// ---- Structured validation ----
function validateBody(body: RequestBody): { ok: true; prompt: string; campaignId: string } | { ok: false; error: string; missingFields: string[] } {
  const prompt = (body.prompt || body.userInput || "").trim();
  const campaignId = (body.campaignId || "").trim();
  const missing: string[] = [];

  if (!prompt) missing.push("prompt");
  if (!campaignId) missing.push("campaignId");

  if (missing.length > 0) {
    return {
      ok: false,
      error: `Chybějící povinná pole: ${missing.join(", ")}`,
      missingFields: missing,
    };
  }

  return { ok: true, prompt, campaignId };
}

export async function POST(request: NextRequest) {
  let body: RequestBody;

  // ---- Parse JSON body ----
  try {
    body = await request.json();
  } catch (parseErr) {
    console.error("[narrate] JSON parse error:", parseErr);
    return NextResponse.json(
      { error: "Nepodařilo se přečíst tělo požadavku (nevalidní JSON).", missingFields: [] },
      { status: 400 }
    );
  }

  // ---- Validate required fields ----
  const validation = validateBody(body);
  if (!validation.ok) {
    console.warn("[narrate] Validation failed:", validation);
    return NextResponse.json(
      { error: validation.error, missingFields: validation.missingFields },
      { status: 400 }
    );
  }

  const { prompt, campaignId } = validation;

  // ---- Validate dice roll sequence (server-side, cannot be bypassed by UI) ----
  const diceRolls: DiceRollRecord[] = Array.isArray(body.diceRolls) ? body.diceRolls : [];
  if (diceRolls.length > 0) {
    const diceValidation = validateDiceRolls(diceRolls);
    if (!diceValidation.ok) {
      console.warn("[narrate] Invalid dice sequence:", diceValidation.error, diceRolls);
      return NextResponse.json(
        { error: diceValidation.error, missingFields: [] },
        { status: 400 }
      );
    }
  }

  // Normalize language (accept lang/language/locale)
  const _language = body.lang || body.language || body.locale || "cs";

  try {
    // ---- Auth + membership check (when Supabase is configured) ----
    const sbEnv = getSupabaseEnv();
    let supabase: Awaited<ReturnType<typeof loadServerSupabase>> = null;

    if (sbEnv) {
      supabase = await loadServerSupabase();
      if (supabase) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          return NextResponse.json(
            { error: "Nepřihlášený uživatel.", missingFields: [] },
            { status: 401 }
          );
        }
        const { data: member } = await supabase
          .from("campaign_members")
          .select("id")
          .eq("user_id", user.id)
          .eq("campaign_id", campaignId)
          .single();
        if (!member) {
          return NextResponse.json(
            { error: "Nemáš přístup k této kampani.", missingFields: [] },
            { status: 403 }
          );
        }
      }
    }

    // ---- Determine provider ----
    let provider: NarrationProvider = localProvider;
    let actualMode: "local" | "ai" = "local";

    if (body.mode === "ai") {
      const aiProvider = getOpenAIProvider();
      if (!aiProvider) {
        return NextResponse.json(
          {
            error: "AI není nakonfigurované. Zadej OpenAI API klíč v nastaveních (⚙️) nebo nastav NARRATOR_AI_API_KEY v .env.local.",
            missingFields: ["NARRATOR_AI_API_KEY"],
          },
          { status: 503 }
        );
      }
      provider = aiProvider;
      actualMode = "ai";
    }

    // ---- Gather context from Supabase (if configured) ----
    let recentEntries: NarrationRequest["recentEntries"] = [];
    let relevantEntries: NarrationRequest["relevantEntries"] = [];
    let eventLog: EventLogEntry[] = [];
    let supabaseMemory: string | null = null;

    if (sbEnv && supabase) {
      try {
        // Memory summary from campaigns table
        const { data: campaignRow } = await supabase
          .from("campaigns")
          .select("memory_summary")
          .eq("id", campaignId)
          .maybeSingle();
        supabaseMemory = campaignRow?.memory_summary ?? null;

        // Recent narrations — Tier 2: last 10
        const { data: recentData } = await supabase
          .from("narrations")
          .select("user_input, narration_text, created_at")
          .eq("campaign_id", campaignId)
          .order("created_at", { ascending: false })
          .limit(10);
        if (recentData) {
          recentEntries = recentData.map((r: { user_input: string; narration_text: string; created_at: string }) => ({
            userInput: r.user_input,
            narrationText: r.narration_text,
            createdAt: r.created_at,
          }));
        }

        // Relevant entries — keyword search across both columns, offset past recent 10, limit 15
        const tokens = Array.from(new Set(
          prompt.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(t => t.length >= 3)
        )).slice(0, 6);
        if (tokens.length > 0) {
          const orClauses = tokens.flatMap(t => [
            `user_input.ilike.%${t}%`,
            `narration_text.ilike.%${t}%`,
          ]).join(",");
          const { data: relData } = await supabase
            .from("narrations")
            .select("user_input, narration_text, created_at")
            .eq("campaign_id", campaignId)
            .or(orClauses)
            .order("created_at", { ascending: false })
            .range(10, 24);
          if (relData) {
            relevantEntries = relData.map((r: { user_input: string; narration_text: string; created_at: string }) => ({
              userInput: r.user_input,
              narrationText: r.narration_text.slice(0, 300), // truncate to control token usage
              createdAt: r.created_at,
            }));
          }
        }
      } catch (dbErr) {
        console.warn("[narrate] Supabase context fetch failed, continuing without:", dbErr);
      }

      // Tier 3: structured event log (memory_entries type='event', last 10)
      try {
        const { data: eventData } = await supabase
          .from("memory_entries")
          .select("title, content, created_at")
          .eq("campaign_id", campaignId)
          .eq("type", "event")
          .order("created_at", { ascending: false })
          .limit(10);
        if (eventData) {
          eventLog = eventData.map((e: { title: string; content: string; created_at: string }) => ({
            title: e.title,
            content: e.content,
            createdAt: e.created_at,
          }));
        }
      } catch (eventErr) {
        console.warn("[narrate] event log fetch failed:", eventErr);
      }
    }

    // ---- Use client-sent recent entries as fallback ----
    if (recentEntries.length === 0 && body.recentEntries && body.recentEntries.length > 0) {
      recentEntries = body.recentEntries.slice(0, 10).map((e) => ({
        userInput: (e.userInput || "").slice(0, 500),
        narrationText: (e.narrationText || "").slice(0, 500),
        createdAt: e.createdAt || "",
      }));
    }

    // ---- Build provider request ----
    const effectiveMemory = supabaseMemory ?? body.memorySummary ?? "";

    // Sanitize characters from client — safety: drop any that leak campaignId mismatch
    const characters: CharacterSnapshot[] = Array.isArray(body.characters)
      ? body.characters
          .filter((c) => {
            const cAny = c as unknown as Record<string, unknown>;
            return !cAny.campaignId || cAny.campaignId === campaignId;
          })
          .slice(0, 20).map((c) => ({
          id: String(c.id || ""),
          name: String(c.name || ""),
          race: String(c.race || ""),
          class: String(c.class || ""),
          level: Number(c.level) || 1,
          hp: typeof c.hp === "number" ? c.hp : undefined,
          maxHp: typeof c.maxHp === "number" ? c.maxHp : undefined,
          xp: typeof c.xp === "number" ? c.xp : undefined,
          statuses: Array.isArray(c.statuses) ? c.statuses.filter((s: unknown) => typeof s === "string") : undefined,
          injuries: Array.isArray(c.injuries) ? c.injuries.filter((s: unknown) => typeof s === "string") : undefined,
          notes: String(c.notes || ""),
          isNPC: !!c.isNPC,
        }))
      : [];

    const narrationRequest: NarrationRequest = {
      campaignId,
      campaignTitle: body.campaignTitle ?? "",
      campaignDescription: body.campaignDescription ?? "",
      memorySummary: effectiveMemory,
      houseRules: body.houseRules ?? "",
      rulesPackText: body.rulesPackText ?? "",
      recentEntries,
      relevantEntries,
      eventLog: eventLog.length > 0 ? eventLog : undefined,
      campaignState: null,
      characters,
      userInput: prompt,
    };

    console.log(`[narrate] mode=${actualMode} campaign=${campaignId} recent=${recentEntries.length} relevant=${relevantEntries.length} events=${eventLog.length} memoryLen=${effectiveMemory.length}`);

    // ---- Generate narration ----
    if (actualMode === "local") {
      await new Promise((r) => setTimeout(r, 300));
    }

    const result = await provider.generate(narrationRequest);

    // ---- Persist to Supabase (if configured) ----
    if (sbEnv && supabase) {
      try {
        await supabase.from("narrations").insert({
          campaign_id: campaignId,
          mode: actualMode === "ai" ? "ai" : "mock",
          user_input: prompt,
          narration_text: result.narrationText,
          suggested_actions: result.suggestedActions ?? [],
          consequences: result.consequences ?? null,
        });

        if (result.updatedMemorySummary) {
          await supabase
            .from("campaigns")
            .update({
              memory_summary: result.updatedMemorySummary,
              updated_at: new Date().toISOString(),
            })
            .eq("id", campaignId);
        }

        // Persist storyBeat to memory_entries (fire-and-forget — doesn't block response)
        if (result.storyBeat) {
          const beat = result.storyBeat;
          supabase
            .from("memory_entries")
            .insert({
              campaign_id: campaignId,
              type: "event",
              title: beat.summary.slice(0, 120),
              content: JSON.stringify(beat),
              tags: [
                ...(beat.location ? [beat.location] : []),
                ...(beat.importantNPCs ?? []).slice(0, 3),
              ].filter(Boolean),
            })
            .then(({ error }) => {
              if (error) console.warn("[narrate] storyBeat memory_entry insert failed:", error.message);
            });
        }
      } catch (dbErr) {
        console.warn("[narrate] Supabase persistence failed:", dbErr);
      }
    }

    return NextResponse.json({
      mode: actualMode,
      narration: result.narrationText,
      suggestions: result.suggestedActions,
      updatedMemorySummary: result.updatedMemorySummary,
      consequences: result.consequences ?? null,
      mapLocation: result.mapLocation ?? null,
      mapMarkers: result.mapMarkers ?? [],
      combatInitiated: result.combatInitiated ?? false,
      combatScene: result.combatScene ?? null,
      debug: {
        recentCount: recentEntries.length,
        relevantCount: relevantEntries.length,
        memoryLength: effectiveMemory.length,
        charactersCount: characters.length,
        supabaseAvailable: !!sbEnv,
        language: _language,
      },
    });
  } catch (err) {
    // ---- Specific error types ----
    const message = err instanceof Error ? err.message : String(err);
    console.error("[narrate] Provider error:", message);

    // OpenAI API errors with detailed status codes
    if (message.includes("OpenAI API error")) {
      const statusMatch = message.match(/\d+/);
      const status = statusMatch ? parseInt(statusMatch[0], 10) : 0;

      let errorMsg = "AI provider vrátil chybu.";
      if (status === 401 || status === 403) {
        errorMsg = "Neplatný API klíč nebo chybějící oprávnění. Zkontroluj NARRATOR_AI_API_KEY v .env.local.";
      } else if (status === 404) {
        errorMsg = `Neznámý model nebo endpoint (HTTP 404). Zkontroluj NARRATOR_AI_MODEL v .env.local. Platné modely: gpt-4o, gpt-4o-mini, gpt-4-turbo.`;
      } else if (status === 429) {
        errorMsg = "Rate limit / kvóta překročena (HTTP 429). Počkej chvíli nebo zkontroluj svůj OpenAI účet.";
      } else if (status) {
        errorMsg = `AI provider vrátil chybu (HTTP ${status}). Zkontroluj NARRATOR_AI_API_KEY v .env.local.`;
      }

      return NextResponse.json(
        {
          error: errorMsg,
          detail: message,
          httpStatus: status || null,
        },
        { status: 502 }
      );
    }

    // JSON parse from AI response
    if (message.includes("JSON") || message.includes("parse") || message.includes("Unexpected token")) {
      return NextResponse.json(
        {
          error: "AI vrátilo nevalidní odpověď. Zkus znovu.",
          detail: message,
        },
        { status: 502 }
      );
    }

    // Generic server error — NOT a 400
    return NextResponse.json(
      {
        error: `Chyba serveru: ${message.slice(0, 200)}`,
        detail: message,
      },
      { status: 500 }
    );
  }
}
