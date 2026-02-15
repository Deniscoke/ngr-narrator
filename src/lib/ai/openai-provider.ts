// ============================================================
// OpenAI Narration Provider — real AI narration via GPT-4o-mini
// ============================================================

import {
  NarrationProvider,
  NarrationRequest,
  NarrationResponse,
  CompactNarrationEntry,
  CharacterSnapshot,
} from "./provider";
import type { CharacterDelta, NarrationConsequences } from "@/types";

const DEFAULT_MODEL = "gpt-4o-mini";
const MAX_TOKENS = 1500;

// ---- System prompt ----

function buildSystemPrompt(req: NarrationRequest): string {
  const parts: string[] = [
    `Jsi mistrovský vypravěč (Game Master) pro stolní RPG kampaň.`,
    `Kampaň: "${req.campaignTitle}".`,
  ];

  if (req.campaignDescription) {
    parts.push(`Popis kampaně: ${req.campaignDescription}`);
  }

  if (req.memorySummary) {
    parts.push(`Dosavadní shrnutí: ${req.memorySummary}`);
  }

  if (req.houseRules) {
    parts.push(`Domácí pravidla: ${req.houseRules}`);
  }

  if (req.rulesPackText) {
    parts.push(`\nBalíček pravidel (Rules Pack):\n${req.rulesPackText}`);
  } else {
    parts.push(`\nPravidla: Obecný fantasy RPG systém. Pokud hráč nespecifikoval pravidla, improvizuj volně.`);
  }

  if (req.campaignState) {
    const s = req.campaignState;
    const stateLines: string[] = [];
    if (s.location) stateLines.push(`Místo: ${s.location}`);
    if (s.scene) stateLines.push(`Scéna: ${s.scene}`);
    if (s.party?.length) stateLines.push(`Skupina: ${s.party.join(", ")}`);
    if (s.npcs?.length) stateLines.push(`NPC: ${s.npcs.join(", ")}`);
    if (s.threads?.length) stateLines.push(`Aktivní vlákna: ${s.threads.join("; ")}`);
    if (s.tone) stateLines.push(`Tón: ${s.tone}`);
    if (stateLines.length > 0) {
      parts.push(`Stav světa:\n${stateLines.join("\n")}`);
    }
  }

  // Characters section
  if (req.characters && req.characters.length > 0) {
    const charLines = req.characters.map((c: CharacterSnapshot) => {
      const bits = [`${c.name} (${c.race} ${c.class}, úroveň ${c.level})`];
      if (c.hp !== undefined) bits.push(`HP: ${c.hp}${c.maxHp ? `/${c.maxHp}` : ""}`);
      if (c.xp !== undefined) bits.push(`XP: ${c.xp}`);
      if (c.statuses?.length) bits.push(`Stavy: ${c.statuses.join(", ")}`);
      if (c.injuries?.length) bits.push(`Zranění: ${c.injuries.join(", ")}`);
      if (c.isNPC) bits.push(`[NPC]`);
      return `- ${bits.join(" | ")}`;
    });
    parts.push(`\nPostavy v kampani:\n${charLines.join("\n")}`);
  }

  parts.push(
    `\nPokyny:`,
    `- Odpověz 2–5 větami popisného vyprávění reagujícího na vstup hráče.`,
    `- Použij atmosférický, poutavý jazyk.`,
    `- Na konci vyprávění přidej komplikaci nebo zajímavý zvrat.`,
    `- Pokud je zadán Balíček pravidel, aplikuj jeho mechaniky (kostky, pravidla boje atd.) ve vyprávění — NECITUJ pravidla doslovně, jen je uplatni.`,
    `- Odpověz v JSON formátu s těmito klíči:`,
    `  narrationText: string (vyprávění)`,
    `  suggestedActions: string[] (přesně 3 návrhy)`,
    `  updatedMemorySummary: string (1–3 věty shrnující kampaň)`,
    `  consequences: { eventSummary: string, deltas: Array<{ characterName: string, xpDelta?: number, hpDelta?: number, addStatuses?: string[], removeStatuses?: string[], addInjuries?: string[], removeInjuries?: string[], addItems?: string[], removeItems?: string[], addNotes?: string[] }>, lootFound?: string[], combatLog?: string } | null`,
    `- V consequences.deltas uveď pouze změny pro existující postavy (použij přesná jména shora).`,
    `- lootFound = předměty nalezené ve scéně (volitelné). combatLog = krátký popis boje (volitelné).`,
    `- Pokud žádné důsledky pro postavy, vrať consequences: null.`,
    `- Odpověz VŽDY česky.`,
    `- Vrať VÝHRADNĚ validní JSON, nic jiného.`
  );

  return parts.join("\n");
}

function buildUserMessage(req: NarrationRequest): string {
  const sections: string[] = [];

  if (req.recentEntries && req.recentEntries.length > 0) {
    const recentLines = req.recentEntries.map(
      (e: CompactNarrationEntry) => `- Hráč: ${e.userInput}\n  Vypravěč: ${e.narrationText.slice(0, 200)}`
    );
    sections.push(`Nedávná historie:\n${recentLines.join("\n")}`);
  }

  if (req.relevantEntries && req.relevantEntries.length > 0) {
    const relLines = req.relevantEntries.map(
      (e: CompactNarrationEntry) => `- [${e.createdAt}] ${e.userInput} → ${e.narrationText.slice(0, 150)}`
    );
    sections.push(`Relevantní starší události:\n${relLines.join("\n")}`);
  }

  sections.push(`Akce hráče: ${req.userInput}`);

  return sections.join("\n\n");
}

// ---- Sanitize consequences from AI ----

function sanitizeConsequences(raw: unknown): NarrationConsequences | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.eventSummary !== "string") return undefined;
  if (!Array.isArray(obj.deltas)) return undefined;

  const deltas: CharacterDelta[] = obj.deltas
    .filter((d: unknown) => d && typeof d === "object" && typeof (d as Record<string, unknown>).characterName === "string")
    .map((d: unknown) => {
      const raw = d as Record<string, unknown>;
      const delta: CharacterDelta = { characterName: String(raw.characterName) };
      if (typeof raw.xpDelta === "number") delta.xpDelta = raw.xpDelta;
      if (typeof raw.hpDelta === "number") delta.hpDelta = raw.hpDelta;
      if (Array.isArray(raw.addStatuses)) delta.addStatuses = raw.addStatuses.filter((s: unknown) => typeof s === "string") as string[];
      if (Array.isArray(raw.removeStatuses)) delta.removeStatuses = raw.removeStatuses.filter((s: unknown) => typeof s === "string") as string[];
      if (Array.isArray(raw.addInjuries)) delta.addInjuries = raw.addInjuries.filter((s: unknown) => typeof s === "string") as string[];
      if (Array.isArray(raw.removeInjuries)) delta.removeInjuries = raw.removeInjuries.filter((s: unknown) => typeof s === "string") as string[];
      if (Array.isArray(raw.addItems)) delta.addItems = raw.addItems.filter((s: unknown) => typeof s === "string") as string[];
      if (Array.isArray(raw.removeItems)) delta.removeItems = raw.removeItems.filter((s: unknown) => typeof s === "string") as string[];
      if (Array.isArray(raw.addNotes)) delta.addNotes = raw.addNotes.filter((s: unknown) => typeof s === "string") as string[];
      return delta;
    });

  if (deltas.length === 0 && !Array.isArray(obj.lootFound) && typeof obj.combatLog !== "string") return undefined;

  const result: NarrationConsequences = { eventSummary: obj.eventSummary, deltas };
  if (Array.isArray(obj.lootFound)) result.lootFound = obj.lootFound.filter((s: unknown) => typeof s === "string") as string[];
  if (typeof obj.combatLog === "string" && obj.combatLog) result.combatLog = obj.combatLog;
  return result;
}

// ---- Provider ----

export class OpenAIProvider implements NarrationProvider {
  private apiKey: string;
  private model: string;

  constructor(apiKey: string, model?: string) {
    this.apiKey = apiKey;
    this.model = model || DEFAULT_MODEL;
  }

  async generate(request: NarrationRequest): Promise<NarrationResponse> {
    const systemPrompt = buildSystemPrompt(request);
    const userMessage = buildUserMessage(request);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        max_tokens: MAX_TOKENS,
        temperature: 0.85,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[OpenAIProvider] API error:", response.status, errBody);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("OpenAI returned empty response");
    }

    const parsed = JSON.parse(content);

    return {
      narrationText: parsed.narrationText || "",
      suggestedActions: Array.isArray(parsed.suggestedActions)
        ? parsed.suggestedActions.slice(0, 3)
        : ["Prozkoumat okolí", "Promluvit s NPC", "Připravit se na boj"],
      updatedMemorySummary: parsed.updatedMemorySummary || request.memorySummary || "",
      updatedCampaignState: parsed.updatedCampaignState ?? null,
      consequences: sanitizeConsequences(parsed.consequences),
    };
  }
}
