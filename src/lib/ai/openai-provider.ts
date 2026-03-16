// ============================================================
// OpenAI Narration Provider — real AI narration via GPT-4o-mini
// ============================================================

import {
  NarrationProvider,
  NarrationRequest,
  NarrationResponse,
  CompactNarrationEntry,
  CharacterSnapshot,
  MapLocation,
  MapMarkerData,
  CombatScene,
  CombatEnemy,
} from "./provider";
import type { CharacterDelta, NarrationConsequences } from "@/types";
import { DH_LITE_RULES, DH_GM_INSTRUCTIONS, DH_PJ_PERSONALITY, DH_COMBAT_INSTRUCTIONS, DH_PARTY_INSTRUCTIONS } from "@/lib/dh-rules";
import { OTHION_LOCATIONS_PROMPT } from "@/data/othion-locations";

const DEFAULT_MODEL = "gpt-4o";
const MAX_COMPLETION_TOKENS = 16384;

// ---- System prompt ----

function buildSystemPrompt(req: NarrationRequest): string {
  const parts: string[] = [
    `Jsi mistrovský vypravěč (Game Master) pro stolní RPG kampaň.`,
    `JAZYK: Komunikuj VŽDY výhradně v češtině. Nikdy nepřecházej do slovenštiny, angličtiny ani jiného jazyka — ani ve jménech kouzel, předmětů nebo míst.`,
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
    parts.push(`\nSystém pravidel: Dračí Hlídka Lite (DH-LITE) — česká dark fantasy RPG.\n${DH_LITE_RULES}`);
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

  // Characters section — full state for AI context
  if (req.characters && req.characters.length > 0) {
    const playerChars = req.characters.filter((c: CharacterSnapshot) => !c.isNPC);
    parts.push(`\n=== POČET POSTAV V KAMPANI: ${playerChars.length} ===`);
    parts.push(`Jména postav: ${playerChars.map((c: CharacterSnapshot) => c.name).join(", ")}. VŽDY ber do úvahy všechny postavy při vyprávění, odměnách a dropech.`);
    const charLines = req.characters.map((c: CharacterSnapshot) => {
      const lines = [`${c.name} (${c.race} ${c.class}, úroveň ${c.level})`];
      if (c.hp !== undefined) lines.push(`HP: ${c.hp}${c.maxHp ? `/${c.maxHp}` : ""}`);
      if (c.xp !== undefined) lines.push(`XP: ${c.xp}`);
      // DH-LITE stats
      const stats = c as unknown as { stats?: Record<string, number> };
      if (stats.stats && typeof stats.stats === "object") {
        const abbr: Record<string, string> = { sila: "SIL", obratnost: "OBR", odolnost: "ODO", inteligence: "INT", charisma: "CHA" };
        const statStr = Object.entries(stats.stats)
          .filter(([, v]) => typeof v === "number")
          .map(([k, v]) => `${abbr[k] || k}:${v}`)
          .join(", ");
        if (statStr) lines.push(`Atributy: ${statStr}`);
      }
      if (c.statuses?.length) lines.push(`Aktivní stavy: ${c.statuses.join(", ")}`);
      if (c.injuries?.length) lines.push(`Zranění: ${c.injuries.join(", ")}`);
      if (c.inventory?.length) lines.push(`Inventář: ${c.inventory.join(", ")}`);
      if (c.notes) lines.push(`Poznámky: ${c.notes}`);
      if (c.isNPC) lines.push(`[NPC]`);
      return `- ${lines.join(" | ")}`;
    });
    parts.push(`\nPostavy v kampani (aktuální stav — VŽDY reflektuj tyto údaje ve vyprávění):\n${charLines.join("\n")}`);
    parts.push(`\nPřizpůsobení pravidel DH-LITE podle postav:`);
    parts.push(`- Ber v úvahu povolání a rasu každé postavy — aplikuj schopnosti a modifikátory podle charakteru (Válečník: těžká brnění bez penalizace, 2× útok od úrovně 5; Zloděj: zákeřný útok +2k6 ze zálohy; Hraničář: stopování, útok ze zálohy +1k6; Kouzelník: mana, kouzla; Klerik: léčení 1k6+CHA; Alchymista: bomba 2k6).`);
    parts.push(`- Rasy: Trpaslík = odolnost vůči jedům, vidění ve tmě; Elf = odolnost kouzlům; Barbar = zuřivost +2; Půlčík = re-roll 1× za sezení; atd.`);
    parts.push(`\nDůležité: Stavy a zranění postav jsou trvalé, dokud nejsou vyléčeny nebo odstraněny příběhovým způsobem. Při generování consequences.deltas přidávej stavy odpovídající pravidlům DH-LITE (např. "Otrávený", "Krvácení", "Vyčerpaný", "Strach", "Oslepený", "Paralyzovaný", "Bezvědomí", "Požehnaný", "Neviditelný", "Zuřivost"). Zranění musí být konkrétní (např. "Zlomená ruka", "Popálení levé nohy", "Řezná rána na hrudi").`);

    parts.push(`\nInventář a předměty:`);
    parts.push(`- Inventář každé postavy je uveden výše. VŽDY ho ber v potaz — pokud hráč použije předmět (lektvar, zbraň, nástroj), odraž to ve vyprávění a v consequences.deltas přidej removeItems.`);
    parts.push(`- DROPY (z nepřítele, truhly, nálezu): VŽDY přidávej do lootFound. Používej standardní názvy pro bonusy: "Meč" (1k6+SIL), "Dýka" (1k4), "Luk" (1k6), "Kladivo" (1k8), "Kůže" (+2 OB), "Kroužky" (+4 OB), "Plát" (+6 OB), "Lektvar léčení" (1k6+1 HP).`);
    parts.push(`- addItems v deltas: POUZE když NPC přímo odevzdá předmět konkrétní postavě (např. "starosta dal Brankovi klíč").`);
    parts.push(`- Quest předměty od NPC: addItems. Předměty z truhly/dropu: lootFound.`);
    parts.push(`- Spotřební předměty (lektvary, jídlo): při použití vždy removeItems.`);
    parts.push(`- suggestedActions může obsahovat akce využívající inventář (např. "Použít Lektvar léčení", "Prozkoumat mapu").`);
  }

  parts.push(OTHION_LOCATIONS_PROMPT);

  parts.push(`\n${DH_PJ_PERSONALITY}`);
  parts.push(`\n${DH_PARTY_INSTRUCTIONS}`);
  parts.push(`\n${DH_COMBAT_INSTRUCTIONS}`);
  parts.push(`\n${DH_GM_INSTRUCTIONS}`);

  parts.push(
    `\nPokyny:`,
    `- Odpověz 2–5 větami vyprávění reagujícího na vstup hráče. Střídej styl: nejen umělecký popis, ale i mechanické momenty (boj, hod kostkou, kouzla, bestiář).`,
    `- Používej bestiář (goblini, vlci, kostlivci, harpyje, dryády, upíři, vlkodlaci, rusalky) a kouzla z DH-LITE.`,
    `- Když situace vyžaduje hod kostkou, VŽDY na konci vyprávění explicitně vyzvi hráče (např. "Hod si k20 na OBR — obtížnost 13."). suggestedActions může obsahovat "Hod k20 na..." akce.`,
    `- Na konci vyprávění přidej komplikaci nebo vyzvání k hodu.`,
    `- Pokud je zadán Balíček pravidel, aplikuj jeho mechaniky — NECITUJ pravidla doslovně, jen je uplatni.`,
    `- Vždy urči, kde se hráč aktuálně nachází na mapě světa Othion.`,
    `- Odpověz v JSON formátu s těmito klíči:`,
    `  narrationText: string (vyprávění)`,
    `  suggestedActions: string[] (přesně 3 návrhy)`,
    `  updatedMemorySummary: string (1–3 věty shrnující kampaň)`,
    `  consequences: { eventSummary: string, deltas: Array<{ characterName: string, xpDelta?: number, hpDelta?: number, addStatuses?: string[], removeStatuses?: string[], addInjuries?: string[], removeInjuries?: string[], addItems?: string[], removeItems?: string[], addNotes?: string[] }>, lootFound?: string[], combatLog?: string } | null`,
    `  mapLocation: { map: "world"|"ihienburgh", locationId: "id_ze_seznamu", locationName: "čitelný název" }`,
    `  mapMarkers: [{ id: "unikátní_id", type: "enemy"|"city"|"poi"|"quest"|"npc", name: "název", locationId: "id_místa", description: "krátký popis", active: true|false }]`,
    `- mapLocation musí vždy obsahovat aktuální polohu hráče (locationId ze seznamu lokací).`,
    `- mapMarkers: přidávej nepřátele, NPC, body zájmu, úkoly dynamicky dle děje. Typ "enemy" pro nepřátele, "npc" pro postavy, "poi" pro poklady/ruiny, "quest" pro úkoly, "city" pro města.`,
    `- V consequences.deltas uveď pouze změny pro existující postavy (použij přesná jména shora).`,
    `- lootFound = předměty nalezené ve scéně, které si ještě nikdo nevzal (zobrazí se hráči). Když postava něco vezme, použij addItems v deltas. combatLog = krátký popis boje (volitelné).`,
    `- Pokud žádné důsledky pro postavy, vrať consequences: null.`,
    `- combatInitiated: true — POUZE když skutečně začíná boj (první kontakt s nepřítelem, přepadení, vyhrožování). Když combatInitiated: true, MUSÍŠ vrátit combatScene.`,
    `- combatScene: { gridCols: 5-8, gridRows: 5-8, enemies: [{ id: "e1", name: "Goblin", hp: 8, maxHp: 8, x: 2, y: 2 }], description: "Jeskyně — goblini se sbíhají" }. Hráčské postavy se umístí automaticky.`,
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

// ---- Sanitize map data from AI ----

function sanitizeMapLocation(raw: unknown): MapLocation | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const map = obj.map === "ihienburgh" ? "ihienburgh" : "world";
  const locationId = typeof obj.locationId === "string" ? obj.locationId : "";
  const locationName = typeof obj.locationName === "string" ? obj.locationName : "";
  if (!locationId) return undefined;
  return { map, locationId, locationName };
}

function sanitizeMapMarkers(raw: unknown): MapMarkerData[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const validTypes = new Set(["enemy", "city", "poi", "quest", "npc"]);
  return raw
    .filter((m: unknown) => m && typeof m === "object")
    .map((m: unknown) => {
      const obj = m as Record<string, unknown>;
      return {
        id: String(obj.id || `m_${Date.now()}_${Math.random().toString(36).slice(2)}`),
        type: (validTypes.has(String(obj.type)) ? String(obj.type) : "poi") as MapMarkerData["type"],
        name: String(obj.name || ""),
        locationId: String(obj.locationId || ""),
        description: String(obj.description || ""),
        active: obj.active !== false,
      };
    })
    .filter(m => m.name && m.locationId);
}

function sanitizeCombatScene(raw: unknown): CombatScene | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const obj = raw as Record<string, unknown>;
  const gridCols = Math.min(10, Math.max(4, Number(obj.gridCols) || 6));
  const gridRows = Math.min(10, Math.max(4, Number(obj.gridRows) || 6));
  const description = String(obj.description || "Bojová scéna");

  const enemies: CombatEnemy[] = [];
  if (Array.isArray(obj.enemies)) {
    for (let i = 0; i < obj.enemies.length; i++) {
      const e = obj.enemies[i];
      if (!e || typeof e !== "object") continue;
      const o = e as Record<string, unknown>;
      const name = String(o.name || `Nepřítel ${i + 1}`);
      const hp = Math.max(0, Number(o.hp) ?? 8);
      const maxHp = Math.max(1, Number(o.maxHp) ?? hp);
      const x = Math.max(0, Math.min(gridCols - 1, Math.floor(Number(o.x) ?? 0)));
      const y = Math.max(0, Math.min(gridRows - 1, Math.floor(Number(o.y) ?? 0)));
      enemies.push({
        id: String(o.id || `enemy_${i}_${Date.now()}`),
        name,
        hp,
        maxHp,
        x,
        y,
      });
    }
  }

  return { gridCols, gridRows, enemies, description };
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
        max_completion_tokens: MAX_COMPLETION_TOKENS,
        // temperature omitted — gpt-5-mini only supports default value (1)
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userMessage },
        ],
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("[OpenAIProvider] API error:", response.status, errBody);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const choice = data.choices?.[0];
    const content = choice?.message?.content;

    console.log("[OpenAIProvider] finish_reason:", choice?.finish_reason, "content_length:", content?.length ?? 0);

    if (!content) {
      const reason = choice?.finish_reason || "unknown";
      console.error("[OpenAIProvider] Empty response. finish_reason:", reason, "usage:", JSON.stringify(data.usage));
      throw new Error(`OpenAI returned empty response (finish_reason: ${reason}). Try shorter prompt or increase max_completion_tokens.`);
    }

    // Extract JSON — model may wrap it in markdown code fences
    let jsonStr = content.trim();
    const fenceMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) jsonStr = fenceMatch[1].trim();
    // Find first { ... } block if there's preamble text
    if (!jsonStr.startsWith("{")) {
      const start = jsonStr.indexOf("{");
      const end = jsonStr.lastIndexOf("}");
      if (start !== -1 && end !== -1) jsonStr = jsonStr.slice(start, end + 1);
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(jsonStr);
    } catch {
      // Fallback: treat entire response as narration text
      console.warn("[OpenAIProvider] JSON parse failed, using raw text as narration");
      return {
        narrationText: content,
        suggestedActions: ["Prozkoumat okolí", "Promluvit s NPC", "Připravit se na boj"],
        updatedMemorySummary: request.memorySummary || "",
        updatedCampaignState: null,
      };
    }

    const mapLocation = sanitizeMapLocation(parsed.mapLocation);
    const mapMarkers = sanitizeMapMarkers(parsed.mapMarkers);
    const combatInitiated = parsed.combatInitiated === true;
    const combatScene = combatInitiated ? sanitizeCombatScene(parsed.combatScene) : undefined;

    return {
      narrationText: String(parsed.narrationText || ""),
      suggestedActions: Array.isArray(parsed.suggestedActions)
        ? (parsed.suggestedActions as unknown[]).slice(0, 3).map(s => String(s))
        : ["Prozkoumat okolí", "Promluvit s NPC", "Připravit se na boj"],
      updatedMemorySummary: String(parsed.updatedMemorySummary || request.memorySummary || ""),
      updatedCampaignState: (parsed.updatedCampaignState as Partial<import("@/types").CampaignState>) ?? null,
      consequences: sanitizeConsequences(parsed.consequences),
      mapLocation,
      mapMarkers,
      combatInitiated: combatInitiated && !!combatScene,
      combatScene,
    };
  }
}
