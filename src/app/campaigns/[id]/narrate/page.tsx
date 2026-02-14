"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { narrationRepo } from "@/lib/storage";
import { NarrationEntry } from "@/types";

type NarrateMode = "local" | "ai";

export default function NarratePage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [prompt, setPrompt] = useState("");
  const [output, setOutput] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<NarrateMode>("local");
  const [recent, setRecent] = useState<NarrationEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadRecent = async () => {
    if (!campaignId) return;
    const all = await narrationRepo.getAll({ campaignId } as Partial<NarrationEntry>);
    const sorted = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setRecent(sorted.slice(0, 5));
  };

  useEffect(() => { loadRecent(); }, [campaignId]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!prompt.trim()) return;
    setLoading(true);
    setError("");
    setOutput("");
    setSuggestions([]);

    try {
      const res = await fetch("/api/narrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim(), campaignId, mode }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Chyba pri generovaní.");
        return;
      }

      setOutput(data.narration);
      setSuggestions(data.suggestions ?? []);

      // Persist to localStorage
      if (campaignId) {
        await narrationRepo.create({
          campaignId,
          mode: mode === "local" ? "mock" : "ai",
          userInput: prompt.trim(),
          narrationText: data.narration,
          suggestedActions: data.suggestions ?? [],
        });
        loadRecent();
      }
    } catch {
      setError("Nepodarilo sa spojiť so serverom.");
    } finally {
      setLoading(false);
    }
  }

  function useSuggestion(s: string) {
    setPrompt(s);
  }

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString("sk-SK", {
        day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
      });
    } catch { return iso; }
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/campaigns/${campaignId}`} className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block">
        ← Späť
      </Link>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold text-zinc-100">Rozprávanie</h1>
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
        </div>
      </div>

      <form onSubmit={handleGenerate} className="mb-6 space-y-3">
        <textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={4}
          placeholder="Opíš situáciu, scénu alebo akciu hráčov..."
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-y"
        />
        <button type="submit" disabled={loading}
          className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-medium text-sm px-4 py-2 rounded transition-colors"
        >{loading ? "Generujem..." : "✨ Generovať narráciu"}</button>
      </form>

      {error && (
        <div className="bg-red-950/50 border border-red-800 rounded-lg p-3 mb-4">
          <p className="text-sm text-red-300">{error}</p>
        </div>
      )}

      {output && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-4">
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">
            Výstup rozprávača ({mode === "local" ? "mock" : "AI"})
          </p>
          <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">{output}</pre>
        </div>
      )}

      {suggestions.length > 0 && (
        <div className="mb-8">
          <p className="text-xs text-zinc-500 mb-2 uppercase tracking-wider">Návrhy akcií</p>
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
            <p className="text-xs text-zinc-500 uppercase tracking-wider">Posledné rozprávania</p>
            <Link href={`/campaigns/${campaignId}/log`}
              className="text-xs text-amber-500 hover:text-amber-400 transition-colors"
            >Celá história →</Link>
          </div>
          <div className="space-y-2">
            {recent.map((entry) => {
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
                    >{isOpen ? "Zavrieť" : "Otvoriť"}</button>
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
