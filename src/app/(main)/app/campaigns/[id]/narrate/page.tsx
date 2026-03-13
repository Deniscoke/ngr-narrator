"use client";

import { useEffect, useState, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { campaignRepo, narrationRepo, characterRepo } from "@/lib/storage";
import { RACE_ICONS, CLASS_ICONS } from "@/lib/dh-constants";
import { Campaign, Character, NarrationEntry, NarrationConsequences, CharacterDelta } from "@/types";
import type { MapLocation, MapMarkerData, CombatScene } from "@/lib/ai/provider";
import GameMap from "@/components/ui/GameMap";
import DiceRoller from "@/components/ui/DiceRoller";
import TalkingNarrator from "@/components/ui/TalkingNarrator";
import CombatMap from "@/components/ui/CombatMap";
import { getItemBonusText } from "@/lib/dh-items";
import { calcOB, getArmorBonusFromInventory, getWeaponDamageFromInventory } from "@/lib/dh-combat";

type NarrateMode = "local" | "ai";

// ---- Speech language options ----
const SPEECH_LANGS = [
  { code: "sk-SK", label: "SK" },
  { code: "cs-CZ", label: "CZ" },
  { code: "en-US", label: "EN" },
] as const;

type SpeechLangCode = (typeof SPEECH_LANGS)[number]["code"];

const LS_SPEECH_LANG = "narrator_speech_lang";

function getSavedSpeechLang(): SpeechLangCode {
  return "cs-CZ";
}

// ---- SpeechRecognition type shim ----
interface SpeechRecognitionResult {
  readonly transcript: string;
  readonly confidence: number;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: { [index: number]: SpeechRecognitionResult };
}
interface SpeechRecogEvent {
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((e: SpeechRecogEvent) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

function getSpeechRecognition(): SpeechRecognitionInstance | null {
  if (typeof window === "undefined") return null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  if (!SR) return null;
  return new SR() as SpeechRecognitionInstance;
}


// ==================================================================

export default function NarratePage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<NarrateMode>("local");
  const [recent, setRecent] = useState<NarrationEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Characters + consequences
  const [characters, setCharacters] = useState<Character[]>([]);
  const [lastConsequences, setLastConsequences] = useState<NarrationConsequences | null>(null);

  // STT state
  const [speechLang, setSpeechLang] = useState<SpeechLangCode>(getSavedSpeechLang);
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // (narrator avatar now handled by TalkingNarrator component)

  // AI key missing banner
  const [aiKeyMissing, setAiKeyMissing] = useState(false);

  // Map state
  const [mapLocation, setMapLocation] = useState<MapLocation | null>(null);
  const [mapMarkers, setMapMarkers] = useState<MapMarkerData[]>([]);

  // Combat mode — mřížková mapa
  const [combatScene, setCombatScene] = useState<CombatScene | null>(null);

  // Loot na zemi — dropy ktoré si hráč môže pretiahnúť do inventára
  const [availableLoot, setAvailableLoot] = useState<string[]>([]);

  // Right panel tab
  const [rightTab, setRightTab] = useState<"characters" | "map">("characters");

  // Dice roll state — setLastDiceRoll is used by DiceRoller callback
  const [, setLastDiceRoll] = useState<string | null>(null);

  // ---- Load persisted prefs from localStorage (client-only) ----
  useEffect(() => {
    const savedLang = localStorage.getItem(LS_SPEECH_LANG);
    if (savedLang && SPEECH_LANGS.some((l) => l.code === savedLang)) {
      setSpeechLang(savedLang as SpeechLangCode);
    }
    if (!getSpeechRecognition()) {
      setSttSupported(false);
    }
  }, []);

  // ---- Data loading ----
  const loadCampaign = async () => {
    if (!campaignId) return;
    const c = await campaignRepo.getById(campaignId);
    if (c) setCampaign(c);
  };

  const loadRecent = async () => {
    if (!campaignId) return;
    const all = await narrationRepo.getAll({ campaignId } as Partial<NarrationEntry>);
    const sorted = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setRecent(sorted.slice(0, 10));
  };

  const loadCharacters = async () => {
    if (!campaignId) return;
    const chars = await characterRepo.getAll({ campaignId } as Partial<Character>);
    setCharacters(chars);
  };

  useEffect(() => {
    loadCampaign();
    loadRecent();
    loadCharacters();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  // ---- Apply character deltas from consequences ----
  async function applyCharacterDeltas(deltas: CharacterDelta[]) {
    for (const delta of deltas) {
      // Case-insensitive name matching (strip diacritics for tolerance)
      const normalize = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      const match = characters.find((c) => normalize(c.name) === normalize(delta.characterName));
      if (!match) {
        console.log(`[consequences] Unknown character "${delta.characterName}", skipping`);
        continue;
      }

      const updates: Partial<Character> = {};

      if (typeof delta.xpDelta === "number") {
        updates.xp = (match.xp ?? 0) + delta.xpDelta;
      }
      if (typeof delta.hpDelta === "number") {
        updates.hp = Math.max(0, (match.hp ?? 0) + delta.hpDelta);
      }

      // Statuses: add + remove, deduplicate
      if (delta.addStatuses?.length || delta.removeStatuses?.length) {
        let statuses = [...(match.statuses ?? [])];
        if (delta.removeStatuses) statuses = statuses.filter((s) => !delta.removeStatuses!.includes(s));
        if (delta.addStatuses) statuses = [...new Set([...statuses, ...delta.addStatuses])];
        updates.statuses = statuses;
      }

      // Injuries: add + remove, deduplicate
      if (delta.addInjuries?.length || delta.removeInjuries?.length) {
        let injuries = [...(match.injuries ?? [])];
        if (delta.removeInjuries) injuries = injuries.filter((s) => !delta.removeInjuries!.includes(s));
        if (delta.addInjuries) injuries = [...new Set([...injuries, ...delta.addInjuries])];
        updates.injuries = injuries;
      }

      // Inventory: add + remove, deduplicate
      if (delta.addItems?.length || delta.removeItems?.length) {
        let inventory = [...(match.inventory ?? [])];
        if (delta.removeItems) inventory = inventory.filter((s) => !delta.removeItems!.includes(s));
        if (delta.addItems) inventory = [...new Set([...inventory, ...delta.addItems])];
        updates.inventory = inventory;
      }

      // Notes: append
      if (delta.addNotes?.length) {
        const existing = match.notes || "";
        updates.notes = [existing, ...delta.addNotes].filter(Boolean).join("\n");
      }

      if (Object.keys(updates).length > 0) {
        console.log(`[consequences] Updating "${match.name}":`, updates);
        await characterRepo.update(match.id, updates);
      }
    }
    // Reload characters to reflect changes
    await loadCharacters();
  }

  // ---- Generate narration ----
  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setOutput("");
    setSuggestions([]);
    setLastConsequences(null);
    setCombatScene(null);
    setAiKeyMissing(false);
    // availableLoot sa nemazá — kumuluje sa

    // Build recent entries for context (last 10 from localStorage)
    const recentForContext = recent.slice(0, 10).map((entry) => ({
      userInput: entry.userInput,
      narrationText: entry.narrationText,
      createdAt: entry.createdAt,
    }));

    // Build characters snapshot with full DH-LITE state
    const charsSnapshot = characters.map((c) => ({
      id: c.id,
      name: c.name,
      race: c.race,
      class: c.class,
      gender: c.gender,
      level: c.level,
      hp: c.hp,
      maxHp: c.maxHp,
      xp: c.xp,
      stats: c.stats,
      statuses: c.statuses,
      injuries: c.injuries,
      inventory: c.inventory,
      notes: c.notes,
      isNPC: c.isNPC,
    }));

    const payload = {
      prompt: prompt.trim(),
      campaignId,
      mode,
      campaignTitle: campaign?.name ?? "",
      campaignDescription: campaign?.description ?? "",
      memorySummary: campaign?.memorySummary ?? "",
      houseRules: campaign?.houseRules ?? "",
      rulesPackText: campaign?.rulesPackText ?? "",
      recentEntries: recentForContext,
      characters: charsSnapshot,
      lang: "cs",
    };

    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        // Check for missing AI key specifically
        if (res.status === 503 && data.missingFields?.includes("NARRATOR_AI_API_KEY")) {
          setAiKeyMissing(true);
        }
        setError(data.error || `Chyba ${res.status}`);
        return;
      }

      setOutput(data.narration);
      setSuggestions(data.suggestions ?? []);

      // Parse consequences
      const consequences: NarrationConsequences | null = data.consequences ?? null;
      setLastConsequences(consequences);

      // Update map state
      if (data.mapLocation) {
        setMapLocation(data.mapLocation);
        setRightTab("map");
      }
      if (data.mapMarkers && Array.isArray(data.mapMarkers)) {
        setMapMarkers(prev => {
          const map = new Map(prev.map(m => [m.id, m]));
          for (const m of data.mapMarkers) {
            map.set(m.id, m);
          }
          return Array.from(map.values());
        });
      }
      if (data.combatInitiated && data.combatScene) {
        setCombatScene(data.combatScene);
      }
      if (consequences?.lootFound?.length) {
        setAvailableLoot(prev => [...prev, ...(consequences.lootFound ?? [])]);
      }

      if (campaignId) {
        await narrationRepo.create({
          campaignId,
          mode: mode === "local" ? "mock" : "ai",
          userInput: prompt.trim(),
          narrationText: data.narration,
          suggestedActions: data.suggestions ?? [],
          consequences: consequences ?? undefined,
        });

        if (data.updatedMemorySummary) {
          const updated = await campaignRepo.update(campaignId, {
            memorySummary: data.updatedMemorySummary,
          });
          setCampaign(updated);
        }

        // Apply character deltas
        if (consequences?.deltas?.length) {
          await applyCharacterDeltas(consequences.deltas);
        }

        loadRecent();
      }
    } catch {
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setLoading(false);
    }
  }

  function useSuggestion(s: string) {
    setPrompt(s);
  }

  // TTS now handled by TalkingNarrator component

  // ---- STT (microphone) ----
  function handleSpeechLangChange(code: SpeechLangCode) {
    setSpeechLang(code);
    localStorage.setItem(LS_SPEECH_LANG, code);
  }

  function startListening() {
    const recognition = getSpeechRecognition();
    if (!recognition) return;

    recognition.lang = speechLang;
    recognition.interimResults = false;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecogEvent) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) {
        setPrompt((prev) => (prev ? prev + " " + transcript : transcript));
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    setListening(true);
    recognition.start();
  }

  function stopListening() {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }

  // ---- Helpers ----
  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString("cs-CZ", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  }

  // ==================================================================
  return (
    <div className="max-w-[1400px]">
      <Link href={`/campaigns/${campaignId}`} className="text-sm mb-4 inline-block transition-colors" style={{ color: "var(--text-muted)" }}>
        ← Zpět
      </Link>

      {/* Two-column layout: main left, characters right */}
      <div className="flex gap-6 items-start">

      {/* ── LEFT: main narrator area ── */}
      <div className="flex-1 min-w-0">

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Vyprávění</h1>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setMode("local")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              mode === "local" ? "dh-btn-primary font-medium" : "dh-input"
            }`}
          >Local mock</button>
          <button onClick={() => setMode("ai")}
            className={`px-3 py-1.5 rounded-lg transition-colors ${
              mode === "ai" ? "dh-btn-primary font-medium" : "dh-input"
            }`}
          >AI mód</button>
        </div>
      </div>


      {/* AI key missing banner */}
      {aiKeyMissing && (
        <div className="bg-amber-950/50 border border-amber-700 rounded-lg p-3 mb-4">
          <p className="text-sm text-amber-300 font-medium mb-1">AI režim není nakonfigurován</p>
          <p className="text-xs text-amber-400/80">
            Přidej <code className="bg-amber-900/50 px-1 rounded">NARRATOR_AI_API_KEY=sk-...</code> do souboru{" "}
            <code className="bg-amber-900/50 px-1 rounded">.env.local</code> a restartuj dev server.
          </p>
        </div>
      )}

      {/* Memory summary hint */}
      <div className="rounded-lg p-3 mb-6 dh-card">
        <p className="text-[10px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>Paměť kampaně (shrnutí)</p>
        <p className="text-xs italic" style={{ color: "var(--text-secondary)" }}>
          {campaign?.memorySummary || "Zatím žádné shrnutí — vygeneruj první vyprávění."}
        </p>
        {campaign?.houseRules && (
          <p className="text-[10px] text-zinc-600 mt-1">
            Pravidla: {campaign.houseRules.slice(0, 80)}{campaign.houseRules.length > 80 ? "…" : ""}
          </p>
        )}
      </div>

      {/* Combat rules quick ref (DH-LITE) */}
      <details className="mb-4 rounded-lg dh-card group">
        <summary className="text-[10px] uppercase tracking-wider cursor-pointer py-2 px-3 list-none flex items-center gap-2" style={{ color: "var(--text-muted)" }}>
          <span className="group-open:rotate-90 transition-transform">▶</span>
          Bojové pravidlá (DH-LITE)
        </summary>
        <div className="px-3 pb-3 pt-0 text-[10px] space-y-1" style={{ color: "var(--text-secondary)" }}>
          <p><strong>Útok:</strong> k20 + oprava SIL (blízko) / OBR (dálka) ≥ OB = zásah</p>
          <p><strong>OB</strong> = 10 + oprava OBR + brnění (Kůže +2, Kroužky +4, Plát +6)</p>
          <p><strong>Poškození:</strong> Dýka 1k4 · Meč 1k6+SIL · Luk 1k6 · Kladivo 1k8</p>
          <p><strong>Krit (20):</strong> 2× poškození · <strong>Minutí (1):</strong> automatický miss</p>
        </div>
      </details>

      {/* Dice Roller */}
      <div className="mb-4">
        <DiceRoller
          characters={characters.map(c => ({ id: c.id, name: c.name }))}
          onRollResult={(charName, diceType, result) => {
            const rollText = `🎲 ${charName} hodil ${result} na ${diceType.toUpperCase()}${result === (diceType === "d6" ? 6 : 20) ? " (kritický úspěch!)" : result === 1 ? " (kritický neúspěch!)" : ""}`;
            setLastDiceRoll(rollText);
            setPrompt(prev => prev ? `${prev}\n${rollText}` : rollText);
          }}
        />
      </div>

      {/* Prompt form */}
      <form onSubmit={handleGenerate} className="mb-6 space-y-3">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
          placeholder="Popiš situaci, scénu nebo akci hráčů… (hod kostkou se automaticky vloží)"
          className="w-full rounded-lg px-3 py-2 text-sm resize-y dh-input"
        />

        {/* Action row: Generate + Mic */}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={loading}
            className="dh-btn-primary disabled:opacity-50 font-medium text-sm px-4 py-2 rounded-lg transition-colors"
          >{loading ? "Generuji..." : "Generovat vyprávění"}</button>

          {/* Microphone */}
          {sttSupported ? (
            <div className="flex items-center gap-1.5">
              {listening ? (
                <button type="button" onClick={stopListening}
                  className="text-xs bg-red-900/60 hover:bg-red-900 text-red-300 px-2.5 py-1.5 rounded transition-colors animate-pulse"
                >Poslouchám…</button>
              ) : (
                <button type="button" onClick={startListening}
                  className="text-xs px-2.5 py-1.5 rounded-lg transition-colors dh-input"
                  title="Diktovat hlasem"
                >Mikrofon</button>
              )}
              <div className="flex items-center gap-0.5">
                {SPEECH_LANGS.map((lang) => (
                  <button key={lang.code} type="button"
                    onClick={() => handleSpeechLangChange(lang.code)}
                    className={`text-[10px] px-1.5 py-1 rounded transition-colors ${
                      speechLang === lang.code ? "font-medium" : ""
                    }`}
                    style={speechLang === lang.code ? { background: "rgba(201,162,39,0.2)", color: "var(--accent-gold)" } : { background: "var(--bg-panel)", color: "var(--text-muted)" }}
                  >{lang.label}</button>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-[10px]" style={{ color: "var(--text-dim)" }}>Hlasový vstup není podporován v tomto prohlížeči.</span>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Combat map — zobrazí se když AI spustí bojový režim */}
      {combatScene && (
        <div className="mb-4">
          <CombatMap
            scene={combatScene}
            characters={characters}
            onClose={() => setCombatScene(null)}
          />
        </div>
      )}

      {/* Narration output with TalkingNarrator */}
      {output && (
        <div className="rounded-xl p-5 mb-4 dh-card">
          <div className="flex gap-5 items-start">
            {/* Narrator avatar + TTS — horizontal, aligned */}
            <div className="flex-shrink-0 pt-0.5">
              <TalkingNarrator text={output} compact speechLang={speechLang} />
            </div>

            {/* Narration text */}
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-[10px] uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                Výstup vypravěče ({mode === "local" ? "mock" : "AI"})
              </p>
              <pre className="text-sm whitespace-pre-wrap font-sans" style={{ color: "var(--text-secondary)" }}>{output}</pre>
              {mapLocation && (
                <div className="mt-3 pt-2 border-t border-zinc-800/40 flex items-center gap-2">
                  <span className="text-[10px] text-zinc-600">📍</span>
                  <span className="text-[10px] text-amber-500/70">{mapLocation.locationName}</span>
                  <span className="text-[9px] text-zinc-700">({mapLocation.map === "ihienburgh" ? "Ihienburgh" : "Svět Othion"})</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Consequences panel */}
      {lastConsequences && (lastConsequences.deltas.length > 0 || lastConsequences.lootFound?.length || lastConsequences.combatLog) && (
        <div className="rounded-lg p-4 mb-4" style={{ background: "var(--bg-panel)", border: "1px solid var(--border-accent)" }}>
          <p className="text-xs uppercase tracking-wider mb-2" style={{ color: "var(--accent-gold)" }}>Důsledky</p>
          <p className="text-xs text-zinc-400 mb-3 italic">{lastConsequences.eventSummary}</p>
          {lastConsequences.combatLog && (
            <p className="text-xs text-red-400/80 mb-3">⚔️ {lastConsequences.combatLog}</p>
          )}
          <div className="space-y-2">
            {lastConsequences.deltas.map((d, i) => (
              <div key={i} className="bg-zinc-800/50 rounded p-2">
                <p className="text-sm text-zinc-200 font-medium mb-1">{d.characterName}</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {typeof d.xpDelta === "number" && d.xpDelta !== 0 && (
                    <span className={d.xpDelta > 0 ? "text-green-400" : "text-red-400"}>
                      XP {d.xpDelta > 0 ? "+" : ""}{d.xpDelta}
                    </span>
                  )}
                  {typeof d.hpDelta === "number" && d.hpDelta !== 0 && (
                    <span className={d.hpDelta > 0 ? "text-green-400" : "text-red-400"}>
                      HP {d.hpDelta > 0 ? "+" : ""}{d.hpDelta}
                    </span>
                  )}
                  {d.addStatuses?.map((s) => (
                    <span key={s} className="text-blue-400">+{s}</span>
                  ))}
                  {d.removeStatuses?.map((s) => (
                    <span key={s} className="text-zinc-500 line-through">-{s}</span>
                  ))}
                  {d.addInjuries?.map((s) => (
                    <span key={s} className="text-orange-400">🩹 {s}</span>
                  ))}
                  {d.removeInjuries?.map((s) => (
                    <span key={s} className="text-zinc-500 line-through">🩹 {s}</span>
                  ))}
                  {d.addItems?.map((s) => (
                    <span key={s} className="text-yellow-400">+🎒 {s}</span>
                  ))}
                  {d.removeItems?.map((s) => (
                    <span key={s} className="text-zinc-500 line-through">🎒 {s}</span>
                  ))}
                  {d.addNotes?.map((s, ni) => (
                    <span key={ni} className="text-zinc-400 italic">📝 {s}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
          {/* Loot je v availableLoot — drag & drop panel nižšie */}
        </div>
      )}

      {/* Loot — pretiahnite do inventára postavy (vpravo) */}
      {availableLoot.length > 0 && (
        <div className="rounded-lg p-4 mb-4 border-2 border-dashed border-amber-700/50" style={{ background: "rgba(161,98,7,0.08)" }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-amber-400">
              🎁 Nalezená kořist — pretiahnite do inventára postavy vpravo
            </p>
            <button
              type="button"
              onClick={() => setAvailableLoot([])}
              className="text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors"
              title="Zahodiť všetko (nechať na zemi)"
            >
              Zahodiť všetko
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableLoot.map((item, i) => {
              const bonusText = getItemBonusText(item);
              return (
                <div
                  key={`${i}-${item}`}
                  draggable
                  onDragStart={(e) => {
                    e.dataTransfer.setData("text/plain", item);
                    e.dataTransfer.effectAllowed = "move";
                  }}
                  title={bonusText ? `${item}\n\n${bonusText}` : item}
                  className="text-xs bg-yellow-900/50 text-yellow-300 px-3 py-1.5 rounded cursor-grab active:cursor-grabbing border border-amber-700/40 hover:border-amber-600 transition-colors flex flex-col"
                >
                  <span>🎁 {item}</span>
                  {bonusText && (
                    <span className="text-[10px] text-amber-400/80 mt-0.5 font-normal">
                      {bonusText}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="mb-8">
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Návrhy akcí</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => useSuggestion(s)}
                className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-3 py-1.5 rounded transition-colors"
              >{s}</button>
            ))}
          </div>
        </div>
      )}

      {/* Recent narrations */}
      {recent.length > 0 && (
        <div className="mt-8 border-t border-zinc-800 pt-6">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Poslední vyprávění</p>
            <Link href={`/campaigns/${campaignId}/log`}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >Celá historie →</Link>
          </div>
          <div className="space-y-2">
            {recent.slice(0, 5).map((entry) => {
              const isOpen = expandedId === entry.id;
              const preview = entry.narrationText.length > 200
                ? entry.narrationText.slice(0, 200) + "…"
                : entry.narrationText;

              return (
                <div key={entry.id} className="border border-zinc-800 rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-zinc-500 mb-1">{formatTime(entry.createdAt)}</p>
                      <p className="text-sm text-zinc-400 truncate">
                        <span className="text-zinc-500">Vstup:</span> {entry.userInput}
                      </p>
                    </div>
                    <button onClick={() => setExpandedId(isOpen ? null : entry.id)}
                      className="text-xs text-zinc-500 hover:text-amber-400 shrink-0 transition-colors"
                    >{isOpen ? "Zavřít" : "Otevřít"}</button>
                  </div>
                  {isOpen ? (
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans mt-2 pt-2 border-t border-zinc-800">
                      {entry.narrationText}
                    </pre>
                  ) : (
                    <p className="text-xs text-zinc-600 mt-1">{preview}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      </div>{/* end LEFT column */}

      {/* ── RIGHT: tabbed sidebar (Characters / Map) ── */}
      <div className="w-96 flex-shrink-0 hidden lg:block">
        <div className="sticky top-4 flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
          {/* Tab switcher */}
          <div className="flex border-b border-zinc-800/60 mb-3">
            <button
              onClick={() => setRightTab("characters")}
              className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-colors ${
                rightTab === "characters"
                  ? "text-amber-400 border-b-2 border-amber-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              🎭 Postavy ({characters.length})
            </button>
            <button
              onClick={() => setRightTab("map")}
              className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-colors ${
                rightTab === "map"
                  ? "text-amber-400 border-b-2 border-amber-500"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              🗺 Mapa {mapLocation ? `· ${mapLocation.locationName}` : ""}
            </button>
          </div>

          {/* Tab content */}
          {rightTab === "characters" ? (
            <div className="flex-1 overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] text-zinc-700 uppercase tracking-wider">HP · XP · Inventár</span>
              </div>
              {characters.length === 0 ? (
                <div className="border border-dashed border-zinc-800 rounded-xl p-4 text-center">
                  <p className="text-zinc-600 text-xs">Žiadne postavy v kampani.</p>
                </div>
              ) : (
                <div className="space-y-3 overflow-y-auto pr-1 flex-1"
                  style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(63,63,70,0.6) transparent", maxHeight: "calc(100vh - 180px)" }}>
                  {characters.map(c => (
                    <LiveCharCard
                      key={c.id}
                      character={c}
                      canAcceptLoot={availableLoot.length > 0}
                      onUpdate={async (updates) => {
                        await characterRepo.update(c.id, updates);
                        await loadCharacters();
                      }}
                      onLootDrop={async (item) => {
                        setAvailableLoot(prev => {
                          const i = prev.indexOf(item);
                          return i >= 0 ? [...prev.slice(0, i), ...prev.slice(i + 1)] : prev;
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
              <GameMap currentLocation={mapLocation} markers={mapMarkers} />
            </div>
          )}
        </div>
      </div>

      </div>{/* end flex row */}
    </div>
  );
}

// ── Live character card — inline HP/XP/inventory editing ──────────────

const STAT_ABBR_NR = [
  ["sila","SIL"],["obratnost","OBR"],["odolnost","ODO"],
  ["inteligence","INT"],["charisma","CHA"],
] as const;

const CLASS_COLOR: Record<string, string> = {
  Válečník:"border-red-700/40", Hraničář:"border-emerald-700/40",
  Alchymista:"border-fuchsia-700/40", Kouzelník:"border-indigo-600/40",
  Zloděj:"border-cyan-700/40", Klerik:"border-amber-600/40",
};

function LiveCharCard({ character: c, onUpdate, canAcceptLoot, onLootDrop }: {
  character: Character;
  onUpdate: (u: Partial<Character>) => Promise<void>;
  canAcceptLoot?: boolean;
  onLootDrop?: (item: string) => void;
}) {
  const [newItem, setNewItem] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const border = CLASS_COLOR[c.class] ?? "border-zinc-700/40";
  const classIcon = CLASS_ICONS[c.class] ?? "⚔️";
  const raceIcon  = RACE_ICONS[c.race]  ?? "👤";

  return (
    <div className={`rounded-xl border ${border} bg-zinc-900/50 p-3 space-y-2`}
      style={{ backdropFilter: "blur(8px)" }}>

      {/* Header row */}
      <div className="flex items-center gap-2">
        {c.portraitUrl ? (
          <img src={c.portraitUrl} alt={c.name} className="w-10 h-10 rounded-lg object-cover object-top flex-shrink-0" />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-xl flex-shrink-0">{classIcon}</div>
        )}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-zinc-200 truncate">{c.name}</p>
          <p className="text-[10px] text-zinc-500 flex items-center gap-1 flex-wrap">
            {raceIcon?.startsWith("/") || raceIcon?.startsWith("http") ? (
              <img src={raceIcon} alt="" className="w-4 h-4 object-contain inline" />
            ) : (
              <span>{raceIcon}</span>
            )}{" "}
            {c.race} · {classIcon} {c.class} · Úr.{c.level}
          </p>
        </div>
        {c.isNPC && <span className="text-[9px] tracking-widest text-zinc-600 uppercase">NPC</span>}
      </div>

      {/* Stats */}
      {c.stats && Object.keys(c.stats).length > 0 && (
        <div className="flex flex-wrap gap-1">
          {STAT_ABBR_NR.map(([k, l]) => c.stats?.[k] !== undefined ? (
            <span key={k} className="text-[10px] rounded px-1.5 py-0.5 font-mono bg-zinc-800 text-zinc-400">
              <span className="text-zinc-500">{l}</span> {c.stats[k]}
            </span>
          ) : null)}
        </div>
      )}

      {/* Combat stats — OB, poškození (DH-LITE) */}
      {c.stats?.obratnost !== undefined && (
        <div className="flex flex-wrap gap-2 text-[10px]">
          <span className="text-zinc-500">
            OB <span className="text-amber-400/90 font-mono">
              {calcOB(c.stats.obratnost, getArmorBonusFromInventory(c.inventory))}
            </span>
          </span>
          {getWeaponDamageFromInventory(c.inventory) && (
            <span className="text-zinc-500">
              Útok <span className="text-red-400/90 font-mono">
                {getWeaponDamageFromInventory(c.inventory)}
              </span>
            </span>
          )}
        </div>
      )}

      {/* HP + XP row */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-600">HP</span>
          <button onClick={() => onUpdate({ hp: Math.max(0, (c.hp??0)-1) })}
            className="w-5 h-5 text-xs bg-zinc-800 hover:bg-red-900/60 rounded text-zinc-400 hover:text-red-300 transition-colors">−</button>
          <span className="text-sm font-bold text-emerald-400 tabular-nums w-8 text-center">
            {c.hp ?? "?"}{c.maxHp ? `/${c.maxHp}` : ""}
          </span>
          <button onClick={() => onUpdate({ hp: Math.min(c.maxHp ?? 999, (c.hp??0)+1) })}
            className="w-5 h-5 text-xs bg-zinc-800 hover:bg-emerald-900/60 rounded text-zinc-400 hover:text-emerald-300 transition-colors">+</button>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-zinc-600">XP</span>
          <span className="text-sm font-semibold text-amber-400 tabular-nums">{c.xp ?? 0}</span>
          <button onClick={() => onUpdate({ xp: (c.xp??0)+10 })}
            className="text-[10px] px-1.5 py-0.5 bg-zinc-800 hover:bg-amber-900/40 rounded text-zinc-500 hover:text-amber-400 transition-colors">+10</button>
          <button onClick={() => onUpdate({ xp: (c.xp??0)+50 })}
            className="text-[10px] px-1.5 py-0.5 bg-zinc-800 hover:bg-amber-900/40 rounded text-zinc-500 hover:text-amber-400 transition-colors">+50</button>
        </div>
      </div>

      {/* Statuses & injuries — read-only, AI-managed context */}
      {(c.statuses?.length || c.injuries?.length) ? (
        <div className="flex flex-wrap gap-1">
          {c.statuses?.map(s => (
            <span key={s} className="text-[9px] bg-blue-900/30 text-blue-300 px-1.5 py-0.5 rounded"
              title="Stav přiřazený vypravěčem — nelze ručně smazat">
              {s}
            </span>
          ))}
          {c.injuries?.map(s => (
            <span key={s} className="text-[9px] bg-orange-900/30 text-orange-300 px-1.5 py-0.5 rounded"
              title="Zranění přiřazené vypravěčem — nelze ručně smazat">
              🩹{s}
            </span>
          ))}
        </div>
      ) : null}

      {/* Notes — AI-managed story context */}
      {c.notes && (
        <p className="text-[10px] italic px-1" style={{ color: "#6a5a3a" }}
          title="Poznámky z příběhu — spravuje vypravěč">
          📜 {c.notes.length > 80 ? c.notes.slice(0, 80) + "…" : c.notes}
        </p>
      )}

      {/* Inventory — drop zone pre loot */}
      <div
        onDragOver={canAcceptLoot ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOver(true); } : undefined}
        onDragLeave={canAcceptLoot ? () => setDragOver(false) : undefined}
        onDrop={canAcceptLoot ? (e) => {
          e.preventDefault();
          setDragOver(false);
          const item = e.dataTransfer.getData("text/plain");
          if (!item) return;
          onUpdate({ inventory: [...(c.inventory ?? []), item] });
          onLootDrop?.(item);
        } : undefined}
        className={canAcceptLoot && dragOver ? "ring-2 ring-amber-500/60 rounded-lg p-1 -m-1 transition-all" : ""}
      >
        <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-1">
          🎒 Inventár {canAcceptLoot && <span className="text-amber-500/70">(drop sem)</span>}
        </p>
        <div className="flex flex-wrap gap-1 mb-1.5 min-h-[24px]">
          {(c.inventory ?? []).length === 0 && !dragOver && (
            <span className="text-[10px] text-zinc-700 italic">prázdný</span>
          )}
          {dragOver && (c.inventory ?? []).length === 0 && (
            <span className="text-[10px] text-amber-500/80 italic">Pustite predmet sem</span>
          )}
          {(c.inventory ?? []).map(item => (
            <span
              key={item}
              title={getItemBonusText(item) || item}
              className="group flex items-center gap-0.5 text-[10px] bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded cursor-pointer hover:bg-zinc-700"
              onClick={() => onUpdate({ inventory: c.inventory?.filter(x => x !== item) ?? [] })}
            >
              {item} <span className="opacity-0 group-hover:opacity-100 text-red-400">×</span>
            </span>
          ))}
        </div>
        <form onSubmit={e => {
          e.preventDefault();
          if (!newItem.trim()) return;
          onUpdate({ inventory: [...(c.inventory ?? []), newItem.trim()] });
          setNewItem("");
        }} className="flex gap-1">
          <input
            value={newItem} onChange={e => setNewItem(e.target.value)}
            placeholder="Pridať predmet…"
            className="flex-1 text-[10px] bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50"
          />
          <button type="submit" className="text-[10px] px-2 py-1 bg-zinc-700 hover:bg-zinc-600 rounded text-zinc-300 transition-colors">+</button>
        </form>
      </div>
    </div>
  );
}

// TalkingNarrator component handles avatar + TTS now
