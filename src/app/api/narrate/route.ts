// ============================================================
// POST /api/narrate — narration endpoint using provider pattern
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { LocalProvider } from "@/lib/ai/local-provider";
import { OpenAIProvider } from "@/lib/ai/openai-provider";
import type { NarrationRequest, NarrationProvider, CompactNarrationEntry, CharacterSnapshot } from "@/lib/ai/provider";

// ---- Supabase imports (optional — only used when env is set) ----
let dbRepo: typeof import("@/lib/db/repo.ts") | null = null;

async function loadDbRepo() {
  if (dbRepo) return dbRepo;
  try {
    // Dynamic import so build doesn't fail if supabase isn't installed
    dbRepo = await import("@/lib/db/repo.ts");
    return dbRepo;
  } catch {
    return null;
  }
}

// ---- Request body — tolerant shape ----
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
  // Language — accept any of these
  lang?: string;
  language?: string;
  locale?: string;
}

const localProvider = new LocalProvider();

// Lazily created — only when AI key is available.
// Re-created if the key changes (e.g. between hot-reload cycles in dev).
let openaiProvider: OpenAIProvider | null = null;
let cachedKey: string | undefined;

function getOpenAIProvider(): OpenAIProvider | null {
  const key = process.env.NARRATOR_AI_API_KEY;
  if (!key) return null;
  // Re-create if key changed (dev hot-reload safety) or first call
  if (!openaiProvider || cachedKey !== key) {
    const model = process.env.NARRATOR_AI_MODEL || "gpt-4o-mini";
    openaiProvider = new OpenAIProvider(key, model);
    cachedKey = key;
  }
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

  // Normalize language (accept lang/language/locale)
  const _language = body.lang || body.language || body.locale || "sk";

  try {
    // ---- Determine provider ----
    let provider: NarrationProvider = localProvider;
    let actualMode: "local" | "ai" = "local";

    if (body.mode === "ai") {
      const aiProvider = getOpenAIProvider();
      if (!aiProvider) {
        // Give the right hint depending on whether we're running on Vercel or locally
        const isVercel = !!process.env.VERCEL;
        const hint = isVercel
          ? "Přidej proměnnou NARRATOR_AI_API_KEY do Vercel dashboardu: Settings → Environment Variables → redeploy."
          : "Nastav NARRATOR_AI_API_KEY v souboru .env.local a restartuj dev server.";
        return NextResponse.json(
          {
            error: `AI režim není nakonfigurován. ${hint}`,
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
    let supabaseMemory: string | null = null;

    const sbEnv = getSupabaseEnv();
    if (sbEnv) {
      try {
        const repo = await loadDbRepo();
        if (repo) {
          supabaseMemory = await repo.ensureCampaignMemory(campaignId);

          const recent = await repo.getRecentNarrations(campaignId, 5);
          recentEntries = recent.map((r: { player_input: string; narrator_output: string; created_at: string }) => ({
            userInput: r.player_input,
            narrationText: r.narrator_output,
            createdAt: r.created_at,
          }));

          relevantEntries = await repo.searchSimilarNarrations(
            campaignId,
            prompt,
            4,
            5
          );
        }
      } catch (dbErr) {
        console.warn("[narrate] Supabase context fetch failed, continuing without:", dbErr);
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
      campaignState: null,
      characters,
      userInput: prompt,
    };

    console.log(`[narrate] mode=${actualMode} campaign=${campaignId} recentEntries=${recentEntries.length} relevantEntries=${relevantEntries.length} memoryLen=${effectiveMemory.length}`);

    // ---- Generate narration ----
    if (actualMode === "local") {
      await new Promise((r) => setTimeout(r, 300));
    }

    const result = await provider.generate(narrationRequest);

    // ---- Persist to Supabase (if configured) ----
    if (sbEnv) {
      try {
        const repo = await loadDbRepo();
        if (repo) {
          await repo.addNarrationEntry({
            campaignId,
            mode: actualMode === "ai" ? "ai" : "mock",
            playerInput: prompt,
            narratorOutput: result.narrationText,
            choices: result.suggestedActions,
          });

          if (result.updatedMemorySummary) {
            await repo.setCampaignMemory(campaignId, result.updatedMemorySummary);
          }
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

      const isVercel = !!process.env.VERCEL;
      const keyLocation = isVercel
        ? "Vercel dashboardu (Settings → Environment Variables)"
        : "souboru .env.local";
      let errorMsg = "AI provider vrátil chybu.";
      if (status === 401 || status === 403) {
        errorMsg = `Neplatný API klíč nebo chybějící oprávnění (HTTP ${status}). Zkontroluj NARRATOR_AI_API_KEY v ${keyLocation}.`;
      } else if (status === 404) {
        errorMsg = `Neznámý model nebo endpoint (HTTP 404). Zkontroluj NARRATOR_AI_MODEL v ${keyLocation}. Platné modely: gpt-4o, gpt-4o-mini, gpt-4-turbo.`;
      } else if (status === 429) {
        errorMsg = "Rate limit / kvóta překročena (HTTP 429). Počkej chvíli nebo zkontroluj svůj OpenAI účet.";
      } else if (message.includes("timeout")) {
        errorMsg = message; // already user-friendly from OpenAIProvider
      } else if (status) {
        errorMsg = `AI provider vrátil chybu (HTTP ${status}). Zkontroluj NARRATOR_AI_API_KEY v ${keyLocation}.`;
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
