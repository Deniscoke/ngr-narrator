// ============================================================
// Local Mock Provider — deterministic, context-aware narration
// ============================================================

import {
  NarrationProvider,
  NarrationRequest,
  NarrationResponse,
} from "./provider";

// ---- Deterministic text selection based on input hash ----

function simpleHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pickByHash<T>(arr: T[], seed: string, offset = 0): T {
  return arr[(simpleHash(seed) + offset) % arr.length];
}

// ---- Scene fragments (Czech, GM narrator tone) ----

const ATMOSPHERE = [
  "Vzduch je těžký a vlhký, světlo se odráží od mokrých stěn.",
  "Vítr nese šepot starých příběhů a vůni jehličí.",
  "Okolí je tiché — až příliš tiché na tuto denní dobu.",
  "Ze stínů se vynořuje obrys něčeho neznámého.",
  "Slunce se skrývá za mraky a krajina je zahalená šerem.",
  "Praskání ohně v dálce naznačuje, že nejste sami.",
  "Cesta se zužuje a stromy se sklánějí nad vámi jako stráže.",
];

const COMPLICATIONS = [
  "Situace se však komplikuje — z nedalké temnoty se ozývá varovný zvuk.",
  "Ale ne všechno je tak jednoduché — všímáte si něco neobvyklého.",
  "Zdá se však, že vás někdo sleduje — cítíte pohled na zádech.",
  "Vaše pozornost je náhle upoutána nečekaným detailem v okolí.",
  "Nečekaný zvrat — situace se mění rychleji, než jste čekali.",
  "Země pod nohama se jemně zachvěje, něco se děje pod povrchem.",
  "Z dálky dorazí zvuk, který vás nutí být na pozoru.",
];

// ---- Suggestion templates keyed by action verbs ----

interface SuggestionSet {
  keywords: string[];
  suggestions: [string, string, string];
}

const SUGGESTION_SETS: SuggestionSet[] = [
  {
    keywords: ["boj", "útok", "meč", "zbran", "drak", "bojov", "zaútoč", "sekn"],
    suggestions: [
      "Zaútočit přímo na nepřítele",
      "Pokusit se o obranný manévr",
      "Hledat slabé místo protivníka",
    ],
  },
  {
    keywords: ["hovor", "rozhovor", "pýta", "opýta", "reč", "oslov", "vyjednáv"],
    suggestions: [
      "Pokračovat v rozhovoru a zjistit více",
      "Nabídnout něco na výměnu za informace",
      "Opatrně změnit téma a pozorovat reakci",
    ],
  },
  {
    keywords: ["hľad", "skúma", "prezr", "prieskum", "otvor", "dvere", "truhl"],
    suggestions: [
      "Důkladně prohledat nejbližší okolí",
      "Postupovat dále s opatrností",
      "Zkontrolovat, zda není v okolí past",
    ],
  },
  {
    keywords: ["les", "príroda", "cest", "choď", "kráča", "cestov"],
    suggestions: [
      "Pokračovat po hlavní cestě",
      "Odbočit a prozkoumat boční stezku",
      "Zastavit se a odpočinout před další cestou",
    ],
  },
];

const DEFAULT_SUGGESTIONS: [string, string, string] = [
  "Prozkoumat okolí opatrně",
  "Pokusit se o interakci s prostředím",
  "Promyslet další postup a připravit se",
];

function pickSuggestions(userInput: string): [string, string, string] {
  const lower = userInput.toLowerCase();
  for (const set of SUGGESTION_SETS) {
    if (set.keywords.some((kw) => lower.includes(kw))) {
      return set.suggestions;
    }
  }
  return DEFAULT_SUGGESTIONS;
}

// ---- Memory builder ----

function buildUpdatedMemory(
  previousSummary: string,
  userInput: string,
  campaignTitle: string
): string {
  const inputSnippet =
    userInput.length > 100 ? userInput.slice(0, 100) + "…" : userInput;

  if (!previousSummary) {
    const title = campaignTitle
      ? `Kampaň „${campaignTitle}" začala.`
      : "Dobrodružství začalo.";
    return `${title} Skupina podnikla první akci: ${inputSnippet}.`;
  }

  // Keep core context (first sentence) + replace action with current
  const sentences = previousSummary.split(". ").filter(Boolean);
  const core = sentences[0];
  return `${core}. Naposledy: ${inputSnippet}. Příběh pokračuje.`;
}

// ---- Provider implementation ----

export class LocalProvider implements NarrationProvider {
  async generate(request: NarrationRequest): Promise<NarrationResponse> {
    const {
      userInput,
      memorySummary,
      houseRules,
      recentEntries,
      campaignTitle,
      characters,
    } = request;

    const seed = userInput + (memorySummary || "");
    const lower = userInput.toLowerCase();

    // 1–2 sentences: recap from memorySummary
    let recapBlock = "";
    if (memorySummary) {
      recapBlock =
        `Dosud: ${memorySummary}\n\n`;
    }

    // House rules note (if present)
    let rulesNote = "";
    if (houseRules && houseRules.trim().length > 0) {
      rulesNote =
        `[Poznámka vypravěče: Platí speciální pravidla — ${houseRules.trim().slice(0, 120)}${houseRules.length > 120 ? "…" : ""}]\n\n`;
    }

    // Recent context hint
    let recentHint = "";
    if (recentEntries && recentEntries.length > 0) {
      const last = recentEntries[0];
      const snippet =
        last.userInput.length > 60
          ? last.userInput.slice(0, 60) + "…"
          : last.userInput;
      recentHint = `Předtím jste: ${snippet}. `;
    }

    // 2–4 sentences: scene reacting to userInput
    const atmosphere = pickByHash(ATMOSPHERE, seed, 0);
    const sceneReaction =
      `${recentHint}Nyní — ${userInput.slice(0, 150)}${userInput.length > 150 ? "…" : ""}.\n\n` +
      `${atmosphere}`;

    // 1–2 sentences: complication
    const complication = pickByHash(COMPLICATIONS, seed, 3);

    // Assemble narration
    const narrationText =
      `${recapBlock}${rulesNote}${sceneReaction}\n\n${complication}\n\nCo uděláte dál?`;

    // Suggestions based on input context
    const suggestedActions = pickSuggestions(userInput);

    // Updated memory
    const updatedMemorySummary = buildUpdatedMemory(
      memorySummary,
      userInput,
      campaignTitle
    );

    // Mock consequences: pick first non-NPC character and give them +10 XP
    const consequences = characters && characters.length > 0
      ? {
          eventSummary: "Dobrodružství pokračuje.",
          deltas: [
            {
              characterName: characters.find((c) => !c.isNPC)?.name ?? characters[0].name,
              xpDelta: 10,
              addStatuses: lower.includes("neviditeľn") || lower.includes("neviditelný") ? ["Neviditelný"] : undefined,
            },
          ].filter((d) => d.characterName),
        }
      : undefined;

    return { narrationText, suggestedActions, updatedMemorySummary, updatedCampaignState: null, consequences };
  }
}
