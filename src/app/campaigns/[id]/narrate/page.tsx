"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { campaignRepo, narrationRepo, characterRepo } from "@/lib/storage";
import { Campaign, Character, NarrationEntry, NarrationConsequences, CharacterDelta } from "@/types";
import { DEFAULT_SPEECH_LANG } from "@/lib/config";

type NarrateMode = "local" | "ai";

// ---- Speech language options ----
const SPEECH_LANGS = [
  { code: "sk-SK", label: "SK" },
  { code: "cs-CZ", label: "CZ" },
  { code: "en-US", label: "EN" },
] as const;

type SpeechLangCode = (typeof SPEECH_LANGS)[number]["code"];

const LS_SPEECH_LANG = "narrator_speech_lang";
const LS_TTS_VOICE = "narrator_tts_voice";

function getSavedSpeechLang(): SpeechLangCode {
  if (typeof window === "undefined") return DEFAULT_SPEECH_LANG;
  const saved = localStorage.getItem(LS_SPEECH_LANG);
  if (saved && SPEECH_LANGS.some((l) => l.code === saved)) return saved as SpeechLangCode;
  return DEFAULT_SPEECH_LANG;
}

function getSavedTtsVoiceName(): string {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(LS_TTS_VOICE) ?? "";
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

// ---- Debug info type ----
interface DebugInfo {
  sentAt: string;
  payload: Record<string, unknown>;
  response: Record<string, unknown> | null;
  error: string | null;
  durationMs: number;
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

  // TTS state
  const [speaking, setSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceName, setSelectedVoiceName] = useState(getSavedTtsVoiceName);

  // STT state
  const [speechLang, setSpeechLang] = useState<SpeechLangCode>(getSavedSpeechLang);
  const [listening, setListening] = useState(false);
  const [sttSupported, setSttSupported] = useState(true);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  // Debug panel state
  const [showDebug, setShowDebug] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo | null>(null);

  // AI key missing banner
  const [aiKeyMissing, setAiKeyMissing] = useState(false);

  // ---- Load voices ----
  const loadVoices = useCallback(() => {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    const v = window.speechSynthesis.getVoices();
    if (v.length > 0) {
      const sorted = [...v].sort((a, b) => {
        const aLocal = a.lang.startsWith("sk") || a.lang.startsWith("cs") ? 0 : 1;
        const bLocal = b.lang.startsWith("sk") || b.lang.startsWith("cs") ? 0 : 1;
        if (aLocal !== bLocal) return aLocal - bLocal;
        return a.name.localeCompare(b.name);
      });
      setVoices(sorted);
    }
  }, []);

  useEffect(() => {
    loadVoices();
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    if (!getSpeechRecognition()) {
      setSttSupported(false);
    }
  }, [loadVoices]);

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
    setAiKeyMissing(false);

    // Build recent entries for context (last 10 from localStorage)
    const recentForContext = recent.slice(0, 10).map((entry) => ({
      userInput: entry.userInput,
      narrationText: entry.narrationText,
      createdAt: entry.createdAt,
    }));

    // Build characters snapshot
    const charsSnapshot = characters.map((c) => ({
      id: c.id,
      name: c.name,
      race: c.race,
      class: c.class,
      level: c.level,
      hp: c.hp,
      maxHp: c.maxHp,
      xp: c.xp,
      statuses: c.statuses,
      injuries: c.injuries,
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

    const startTime = Date.now();

    // Log to console for debugging
    console.log("[narrate:client] Sending payload:", JSON.stringify(payload, null, 2));

    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const durationMs = Date.now() - startTime;

      // Update debug info
      setDebugInfo({
        sentAt: new Date().toISOString(),
        payload,
        response: data,
        error: res.ok ? null : (data.error || `HTTP ${res.status}`),
        durationMs,
      });

      console.log("[narrate:client] Response:", JSON.stringify(data, null, 2), `(${durationMs}ms)`);

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
      const durationMs = Date.now() - startTime;
      setDebugInfo({
        sentAt: new Date().toISOString(),
        payload,
        response: null,
        error: "Network error — server unreachable",
        durationMs,
      });
      setError("Nepodařilo se spojit se serverem.");
    } finally {
      setLoading(false);
    }
  }

  function useSuggestion(s: string) {
    setPrompt(s);
  }

  // ---- TTS ----
  function getSelectedVoice(): SpeechSynthesisVoice | undefined {
    if (!selectedVoiceName) return undefined;
    return voices.find((v) => v.name === selectedVoiceName);
  }

  function handleSpeak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = getSelectedVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = speechLang;
    }
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  function handleStopSpeech() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  }

  function handleVoiceChange(name: string) {
    setSelectedVoiceName(name);
    localStorage.setItem(LS_TTS_VOICE, name);
  }

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
    <div className="max-w-3xl">
      <Link href={`/campaigns/${campaignId}`} className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block">
        ← Zpět
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-100">Vyprávění</h1>
        <div className="flex items-center gap-2 text-xs">
          <button onClick={() => setMode("local")}
            className={`px-3 py-1.5 rounded transition-colors ${
              mode === "local" ? "bg-amber-600 text-black font-medium" : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >Local mock</button>
          <button onClick={() => setMode("ai")}
            className={`px-3 py-1.5 rounded transition-colors ${
              mode === "ai" ? "bg-amber-600 text-black font-medium" : "bg-zinc-800 text-zinc-500 hover:text-zinc-300"
            }`}
            title="Vyžaduje NARRATOR_AI_API_KEY v .env.local"
          >AI mód</button>
          <button onClick={() => setShowDebug((d) => !d)}
            className={`px-2 py-1.5 rounded transition-colors text-[10px] ${
              showDebug ? "bg-zinc-700 text-zinc-200" : "bg-zinc-900 text-zinc-600 hover:text-zinc-400"
            }`}
            title="Zobrazit debug panel"
          >DBG</button>
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
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 mb-6">
        <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Paměť kampaně (shrnutí)</p>
        <p className="text-xs text-zinc-400 italic">
          {campaign?.memorySummary || "Zatím žádné shrnutí — vygeneruj první vyprávění."}
        </p>
        {campaign?.houseRules && (
          <p className="text-[10px] text-zinc-600 mt-1">
            Pravidla: {campaign.houseRules.slice(0, 80)}{campaign.houseRules.length > 80 ? "…" : ""}
          </p>
        )}
      </div>

      {/* Prompt form */}
      <form onSubmit={handleGenerate} className="mb-6 space-y-3">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
          placeholder="Popiš situaci, scénu nebo akci hráčů..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-y"
        />

        {/* Action row: Generate + Mic */}
        <div className="flex items-center gap-3 flex-wrap">
          <button type="submit" disabled={loading}
            className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-medium text-sm px-4 py-2 rounded transition-colors"
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
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1.5 rounded transition-colors"
                  title="Diktovat hlasem"
                >Mikrofon</button>
              )}
              <div className="flex items-center gap-0.5">
                {SPEECH_LANGS.map((lang) => (
                  <button key={lang.code} type="button"
                    onClick={() => handleSpeechLangChange(lang.code)}
                    className={`text-[10px] px-1.5 py-1 rounded transition-colors ${
                      speechLang === lang.code
                        ? "bg-zinc-600 text-zinc-100 font-medium"
                        : "bg-zinc-800/50 text-zinc-500 hover:text-zinc-300"
                    }`}
                  >{lang.label}</button>
                ))}
              </div>
            </div>
          ) : (
            <span className="text-[10px] text-zinc-600">Hlasový vstup není podporován v tomto prohlížeči.</span>
          )}
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {/* Narration output */}
      {output && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
            <div className="flex items-center gap-3">
              <NarratorAvatar speaking={speaking} onClick={() => handleSpeak(output)} />
              <p className="text-xs text-zinc-500 uppercase tracking-wider">
                Výstup vypravěče ({mode === "local" ? "mock" : "AI"})
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              {voices.length > 0 && (
                <select
                  value={selectedVoiceName}
                  onChange={(e) => handleVoiceChange(e.target.value)}
                  className="text-[10px] bg-zinc-800 border border-zinc-700 text-zinc-400 rounded px-1.5 py-1 max-w-[160px] focus:outline-none focus:border-zinc-500"
                  title="Vybrat hlas"
                >
                  <option value="">Výchozí hlas</option>
                  {voices.map((v) => (
                    <option key={v.name} value={v.name}>
                      {v.name} ({v.lang})
                    </option>
                  ))}
                </select>
              )}
              {speaking ? (
                <button onClick={handleStopSpeech}
                  className="text-xs bg-red-900/50 hover:bg-red-900 text-red-300 px-2.5 py-1 rounded transition-colors"
                >Zastavit</button>
              ) : (
                <button onClick={() => handleSpeak(output)}
                  className="text-xs bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-2.5 py-1 rounded transition-colors"
                >Přečíst</button>
              )}
            </div>
          </div>
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">{output}</pre>
        </div>
      )}

      {/* Consequences panel */}
      {lastConsequences && (lastConsequences.deltas.length > 0 || lastConsequences.lootFound?.length || lastConsequences.combatLog) && (
        <div className="bg-zinc-900/70 border border-amber-800/50 rounded-lg p-4 mb-4">
          <p className="text-xs text-amber-500 uppercase tracking-wider mb-2">Důsledky</p>
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
          {lastConsequences.lootFound && lastConsequences.lootFound.length > 0 && (
            <div className="mt-3 pt-2 border-t border-amber-800/30">
              <p className="text-xs text-yellow-500 mb-1">Nalezená kořist</p>
              <div className="flex flex-wrap gap-1.5">
                {lastConsequences.lootFound.map((item, i) => (
                  <span key={i} className="text-xs bg-yellow-900/30 text-yellow-400 px-2 py-0.5 rounded">🎁 {item}</span>
                ))}
              </div>
            </div>
          )}
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

      {/* Debug Panel */}
      {showDebug && debugInfo && (
        <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 mb-6 font-mono text-[11px]">
          <div className="flex items-center justify-between mb-2">
            <p className="text-zinc-400 uppercase tracking-wider text-[10px]">Debug Panel</p>
            <span className="text-zinc-600">
              {debugInfo.durationMs}ms • {debugInfo.sentAt.slice(11, 19)}
            </span>
          </div>
          {debugInfo.error && (
            <p className="text-red-400 mb-2">Error: {debugInfo.error}</p>
          )}
          <details className="mb-2">
            <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300">Request payload</summary>
            <pre className="text-zinc-500 mt-1 overflow-auto max-h-48 text-[10px]">
              {JSON.stringify(debugInfo.payload, null, 2)}
            </pre>
          </details>
          <details>
            <summary className="text-zinc-500 cursor-pointer hover:text-zinc-300">Response</summary>
            <pre className="text-zinc-500 mt-1 overflow-auto max-h-48 text-[10px]">
              {debugInfo.response ? JSON.stringify(debugInfo.response, null, 2) : "null"}
            </pre>
          </details>
        </div>
      )}

      {showDebug && !debugInfo && (
        <div className="bg-zinc-950 border border-zinc-700 rounded-lg p-3 mb-6">
          <p className="text-[11px] text-zinc-600 italic">Debug: ještě nebyla provedena žádná požadavka.</p>
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
    </div>
  );
}

// ---- Narrator Avatar with mouth animation ----
function NarratorAvatar({ speaking, onClick }: { speaking: boolean; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="narrator-avatar-container cursor-pointer"
      title="Klikni pro přečtení vyprávění"
    >
      <div className={`narrator-avatar ${speaking ? "speaking" : ""}`} />
    </div>
  );
}
