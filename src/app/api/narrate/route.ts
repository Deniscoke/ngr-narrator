// ============================================================
// POST /api/narrate — mock narration endpoint
// ============================================================
// In "local" mode: returns generated mock narration.
// In "ai" mode (future): will call external LLM API.
// All output is original text — no copyrighted content.
// ============================================================

import { NextRequest, NextResponse } from "next/server";

interface NarrateRequest {
  prompt: string;
  campaignId: string;
  mode: "local" | "ai";
}

const SCENE_OPENINGS = [
  "Hustá hmla sa vznáša nad krajinou, keď skupina vstupuje do neznámej oblasti.",
  "Svetlo pochodne tancuje po kamenných stenách chodby.",
  "Vietor prináša zvláštnu vôňu — zmes dymu a bylín — z neďalekého osídlenia.",
  "Ticho lesa je prerušené prasknutím konára niekde v tme.",
  "Strážca pri bráne si vás premeria podozrievavým pohľadom.",
];

const SCENE_MIDDLES = [
  "Okolie prezrádza stopy nedávnej aktivity — niekto tu bol pred vami.",
  "V diaľke sa ozýva zvuk, ktorý by mohol byť buď spev alebo volanie o pomoc.",
  "Miestny obyvateľ vám ponúkne informáciu výmenou za drobnú službu.",
  "Stopy na zemi vedú dvoma smermi — jeden do temnoty, druhý k svetlu.",
  "Vo vzduchu cítiť napätie — niečo sa blíži.",
];

const SUGGESTIONS = [
  "Preskúmať okolie opatrne",
  "Osloviť postavu v blízkosti",
  "Pripraviť sa na stretnutie",
  "Hľadať skrytý priechod",
  "Vrátiť sa a premyslieť ďalší postup",
];

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function generateMockNarration(prompt: string): {
  narration: string;
  suggestions: string[];
} {
  const opening = pickRandom(SCENE_OPENINGS);
  const middle = pickRandom(SCENE_MIDDLES);

  const narration =
    `${opening}\n\n` +
    `Na základe toho, čo sa deje — ${prompt.slice(0, 120)}${prompt.length > 120 ? "..." : ""} — ` +
    `rozprávač opisuje nasledovné:\n\n` +
    `${middle}\n\n` +
    `Čo urobíte ďalej?`;

  // Pick 3 random suggestions
  const shuffled = [...SUGGESTIONS].sort(() => Math.random() - 0.5);
  return { narration, suggestions: shuffled.slice(0, 3) };
}

export async function POST(request: NextRequest) {
  try {
    const body: NarrateRequest = await request.json();

    if (!body.prompt?.trim()) {
      return NextResponse.json(
        { error: "Prompt je povinný." },
        { status: 400 }
      );
    }

    if (body.mode === "ai") {
      // Future: check for API key env var
      const hasKey = !!process.env.NARRATOR_AI_API_KEY;
      if (!hasKey) {
        return NextResponse.json(
          { error: "AI mód nie je nakonfigurovaný. Nastav NARRATOR_AI_API_KEY." },
          { status: 503 }
        );
      }
      // TODO: implement actual AI call
      return NextResponse.json(
        { error: "AI mód ešte nie je implementovaný." },
        { status: 501 }
      );
    }

    // Local mock mode
    // Simulate slight delay
    await new Promise((r) => setTimeout(r, 300));

    const result = generateMockNarration(body.prompt.trim());

    return NextResponse.json({
      mode: "local",
      narration: result.narration,
      suggestions: result.suggestions,
    });
  } catch {
    return NextResponse.json(
      { error: "Neplatný požiadavok." },
      { status: 400 }
    );
  }
}
