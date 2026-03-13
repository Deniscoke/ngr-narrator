"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CLASS_ICONS } from "@/lib/dh-constants";

interface HallEntry {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  last_seen_at: string;
  created_at: string;
  characters: Array<{
    id: string;
    name: string;
    race: string;
    class: string;
    level: number;
  }>;
  character_count: number;
}

export default function SienSlavyPage() {
  const [entries, setEntries] = useState<HallEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/hall-of-fame")
      .then((r) => {
        if (!r.ok) throw new Error(r.status === 503 ? "Supabase nie je nakonfigurovaný" : "Chyba načítania");
        return r.json();
      })
      .then((data) => {
        setEntries(data.entries ?? []);
        setError(null);
      })
      .catch((e) => {
        setError(e.message);
        setEntries([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Načítavam sieň slávy…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-3xl">
        <div className="rounded-xl p-6 dh-card">
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>{error}</p>
          <p className="text-xs mt-2" style={{ color: "var(--text-dim)" }}>
            Nastav NEXT_PUBLIC_SUPABASE_URL a NEXT_PUBLIC_SUPABASE_ANON_KEY v .env.local a spusti migráciu schémy (schema-profiles.sql).
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>Sieň slávy</h1>
      <p className="text-sm mb-8" style={{ color: "var(--text-muted)" }}>
        Všetci hráči, ktorí sa kedy prihlásili, a ich postavy.
      </p>

      {entries.length === 0 ? (
        <div className="rounded-xl p-6 dh-card" style={{ borderStyle: "dashed" }}>
          <p className="text-sm" style={{ color: "var(--text-muted)" }}>
            Zatiaľ žiadni hráči. Prihlás sa cez Google a budeš prvý v sieni slávy!
          </p>
          <Link href="/" className="inline-block mt-4 text-sm" style={{ color: "var(--accent-gold)" }}>
            Prihlásiť sa →
          </Link>
        </div>
      ) : (
        <div className="space-y-6">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl p-5 dh-card">
              <div className="flex items-start gap-4">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" style={{ border: "2px solid var(--border-default)" }} />
                ) : (
                  <div className="w-12 h-12 rounded-full flex items-center justify-center text-xl flex-shrink-0" style={{ background: "var(--bg-panel)", border: "2px solid var(--border-default)" }}>
                    👤
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-bold" style={{ color: "var(--text-primary)" }}>
                    {entry.display_name ?? "Hráč"}
                  </p>
                  <p className="text-[10px] mb-3" style={{ color: "var(--text-dim)" }}>
                    {entry.character_count} {entry.character_count === 1 ? "postava" : entry.character_count < 5 ? "postavy" : "postáv"}
                  </p>
                  {entry.characters.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {entry.characters.map((c) => (
                        <span
                          key={c.id}
                          className="text-[11px] px-2 py-1 rounded"
                          style={{ background: "rgba(139,115,85,0.2)", color: "var(--text-secondary)", border: "1px solid var(--border-subtle)" }}
                        >
                          {CLASS_ICONS[c.class] ?? "⚔️"} {c.name} · {c.race} {c.class} Úr.{c.level}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-8">
        <Link href="/app" className="text-sm" style={{ color: "var(--text-muted)" }}>
          ← Späť na domov
        </Link>
      </div>
    </div>
  );
}
