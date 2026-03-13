"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { campaignRepo } from "@/lib/storage";
import { Campaign } from "@/types";

export default function CampaignSettingsPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const router = useRouter();
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [rulesPackText, setRulesPackText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    loadCampaign();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [campaignId]);

  async function loadCampaign() {
    if (!campaignId) return;
    const c = await campaignRepo.getById(campaignId);
    if (c) {
      setCampaign(c);
      setRulesPackText(c.rulesPackText || "");
    }
  }

  async function handleSave() {
    if (!campaignId) return;
    setSaving(true);
    setSaved(false);

    try {
      const updated = await campaignRepo.update(campaignId, {
        rulesPackText: rulesPackText.trim(),
      });
      setCampaign(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error("Failed to save rules pack:", err);
    } finally {
      setSaving(false);
    }
  }

  if (!campaign) {
    return (
      <div className="max-w-3xl">
        <p className="text-sm text-zinc-500">Načítání...</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      <Link href={`/campaigns/${campaignId}`} className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block">
        ← Zpět
      </Link>

      <h1 className="text-xl font-bold text-zinc-100 mb-6">Nastavení kampaně</h1>

      {/* Campaign info */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
        <h2 className="text-sm font-medium text-zinc-300 mb-2">{campaign.name}</h2>
        <p className="text-xs text-zinc-500">{campaign.description || "Bez popisu"}</p>
      </div>

      {/* Rules Pack editor */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="mb-3">
          <h2 className="text-sm font-medium text-zinc-200 mb-1">Balíček pravidel (Rules Pack)</h2>
          <p className="text-xs text-zinc-500">
            Vlastní pravidla, poznámky nebo kontext pro AI (plain text). Tato pole budou součástí každého volání AI.
          </p>
        </div>

        <textarea
          value={rulesPackText}
          onChange={(e) => setRulesPackText(e.target.value)}
          rows={12}
          placeholder="Například:&#10;- Kampaň používá úroveňový systém 1-20&#10;- Kritický zásah = 2x poškození&#10;- Magie je vzácná a nebezpečná&#10;- Tón: temný fantasy s politickými intriky"
          className="w-full bg-zinc-950 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 resize-y font-mono"
        />

        <div className="flex items-center justify-between mt-3">
          <p className="text-[10px] text-zinc-600">
            {rulesPackText.length} znaků
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-xs text-green-500">✓ Uloženo</span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-amber-600 hover:bg-amber-500 disabled:opacity-50 text-black font-medium text-sm px-4 py-2 rounded transition-colors"
            >
              {saving ? "Ukládám..." : "Uložit"}
            </button>
          </div>
        </div>
      </div>

      {/* House Rules (existing field) */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-3 mb-4">
        <p className="text-xs text-zinc-500 mb-1">Domácí pravidla (stará pole)</p>
        <p className="text-xs text-zinc-400 italic">
          {campaign.houseRules || "Žádná"}
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => router.push(`/campaigns/${campaignId}/narrate`)}
          className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 px-4 py-2 rounded transition-colors"
        >
          Přejít na vyprávění
        </button>
      </div>
    </div>
  );
}
