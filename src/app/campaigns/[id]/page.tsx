"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { campaignRepo } from "@/lib/storage";
import { Campaign } from "@/types";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [houseRules, setHouseRules] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (id) {
      campaignRepo.getById(id).then((c) => {
        if (c) {
          setCampaign(c);
          setHouseRules(c.houseRules ?? "");
        }
      });
    }
  }, [id]);

  async function handleSaveNotes() {
    if (!campaign) return;
    setSaving(true);
    const updated = await campaignRepo.update(campaign.id, { houseRules });
    setCampaign(updated);
    setSaving(false);
  }

  if (!campaign) {
    return <p className="text-zinc-500">Načítání kampaně...</p>;
  }

  const sections = [
    { href: `/campaigns/${id}/sessions`, label: "Sezení", icon: "📅" },
    { href: `/campaigns/${id}/characters`, label: "Postavy", icon: "🧙" },
    { href: `/campaigns/${id}/narrate`, label: "Vyprávění", icon: "✨" },
    { href: `/campaigns/${id}/settings`, label: "Nastavení", icon: "⚙️" },
  ];

  return (
    <div className="max-w-3xl">
      <Link
        href="/campaigns"
        className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block"
      >
        ← Zpět na kampaně
      </Link>

      {/* Campaign badge */}
      <div className="flex items-center gap-3 mb-1">
        <h1 className="text-xl font-bold text-zinc-100">{campaign.name}</h1>
        {campaign.passwordHash && (
          <span className="text-amber-500 text-xs" title="Zamčená kampaň">🔒</span>
        )}
        <span className="text-[10px] text-zinc-600 font-mono bg-zinc-800/50 px-1.5 py-0.5 rounded">{campaign.id.slice(0, 8)}</span>
      </div>
      {campaign.description && (
        <p className="text-zinc-400 text-sm mb-6">{campaign.description}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-4 mb-8">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="border border-zinc-800 rounded-lg p-4 text-center hover:border-amber-500/50 transition-colors"
          >
            <p className="text-2xl mb-2">{s.icon}</p>
            <p className="text-sm font-medium text-zinc-300">{s.label}</p>
          </Link>
        ))}
      </div>

      {/* House rules / notes */}
      <div className="border-t border-zinc-800 pt-6 mb-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
          Poznámky / domácí pravidla
        </p>
        <textarea
          value={houseRules}
          onChange={(e) => setHouseRules(e.target.value)}
          rows={4}
          placeholder="Sem zapiš domácí pravidla, poznámky ke kampani…"
          className="w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-y mb-2"
        />
        <button
          onClick={handleSaveNotes}
          disabled={saving || houseRules === (campaign.houseRules ?? "")}
          className="bg-zinc-700 hover:bg-zinc-600 disabled:opacity-40 text-zinc-200 text-xs px-3 py-1.5 rounded transition-colors"
        >
          {saving ? "Ukládám…" : "Uložit poznámky"}
        </button>
      </div>

      {/* Memory summary (read-only) */}
      <div className="border-t border-zinc-800 pt-6">
        <p className="text-xs text-zinc-500 uppercase tracking-wider mb-2">
          Paměť kampaně (shrnutí)
        </p>
        <div className="bg-zinc-900/50 border border-zinc-800 rounded p-3">
          <p className="text-sm text-zinc-400 italic">
            {campaign.memorySummary || "Zatím žádné shrnutí — vygeneruj první vyprávění."}
          </p>
        </div>
      </div>
    </div>
  );
}
