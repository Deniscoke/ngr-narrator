"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { narrationRepo } from "@/lib/storage";
import { NarrationEntry } from "@/types";

const MAX_ENTRIES = 50;

export default function NarrationLogPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [entries, setEntries] = useState<NarrationEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadEntries = async () => {
    if (!campaignId) return;
    const all = await narrationRepo.getAll({ campaignId } as Partial<NarrationEntry>);
    const sorted = all.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    setEntries(sorted.slice(0, MAX_ENTRIES));
  };

  useEffect(() => {
    loadEntries();
  }, [campaignId]);

  async function handleDelete(entryId: string) {
    if (!confirm("Naozaj chceš vymazať tento záznam?")) return;
    await narrationRepo.delete(entryId);
    loadEntries();
  }

  function formatTime(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleString("sk-SK", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return iso;
    }
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/campaigns/${campaignId}/narrate`}
        className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block"
      >
        ← Späť na rozprávanie
      </Link>

      <h1 className="text-xl font-bold text-zinc-100 mb-6">
        História rozprávání
      </h1>

      {entries.length === 0 ? (
        <p className="text-sm text-zinc-500">Zatiaľ žiadne záznamy.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const isOpen = expandedId === entry.id;

            return (
              <div
                key={entry.id}
                className="border border-zinc-800 rounded-lg p-3"
              >
                {/* Header row */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-zinc-500">
                        {formatTime(entry.createdAt)}
                      </span>
                      <span
                        className={`text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded ${
                          entry.mode === "ai"
                            ? "bg-violet-900/50 text-violet-300"
                            : "bg-zinc-800 text-zinc-400"
                        }`}
                      >
                        {entry.mode}
                      </span>
                    </div>
                    <p className="text-sm text-zinc-400">
                      <span className="text-zinc-500">Vstup:</span>{" "}
                      {entry.userInput}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() =>
                        setExpandedId(isOpen ? null : entry.id)
                      }
                      className="text-xs text-zinc-500 hover:text-amber-400 transition-colors"
                    >
                      {isOpen ? "Zavrieť" : "Otvoriť"}
                    </button>
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className="text-xs text-zinc-600 hover:text-red-400 transition-colors"
                      title="Vymazať záznam"
                    >
                      ✕
                    </button>
                  </div>
                </div>

                {/* Narration text — collapsible */}
                {isOpen && (
                  <div className="mt-2 pt-2 border-t border-zinc-800">
                    <pre className="text-sm text-zinc-300 whitespace-pre-wrap font-sans">
                      {entry.narrationText}
                    </pre>

                    {/* Suggested actions */}
                    {entry.suggestedActions &&
                      entry.suggestedActions.length > 0 && (
                        <div className="mt-3">
                          <p className="text-xs text-zinc-500 mb-1 uppercase tracking-wider">
                            Návrhy akcií
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {entry.suggestedActions.map((action, i) => (
                              <span
                                key={i}
                                className="text-xs bg-zinc-800 text-zinc-400 px-2 py-1 rounded"
                              >
                                {action}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {entries.length >= MAX_ENTRIES && (
        <p className="text-xs text-zinc-600 mt-4 text-center">
          Zobrazených max. {MAX_ENTRIES} záznamov.
        </p>
      )}
    </div>
  );
}
