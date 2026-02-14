"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { campaignRepo } from "@/lib/storage";
import { Campaign } from "@/types";

export default function CampaignDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [campaign, setCampaign] = useState<Campaign | null>(null);

  useEffect(() => {
    if (id) campaignRepo.getById(id).then(setCampaign);
  }, [id]);

  if (!campaign) {
    return <p className="text-zinc-500">Načítavam kampaň...</p>;
  }

  const sections = [
    { href: `/campaigns/${id}/sessions`, label: "Sedenia", icon: "📅" },
    { href: `/campaigns/${id}/characters`, label: "Postavy", icon: "🧙" },
    { href: `/campaigns/${id}/narrate`, label: "Rozprávanie", icon: "✨" },
  ];

  return (
    <div className="max-w-3xl">
      <Link
        href="/campaigns"
        className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block"
      >
        ← Späť na kampane
      </Link>

      <h1 className="text-xl font-bold text-zinc-100 mb-1">{campaign.name}</h1>
      {campaign.description && (
        <p className="text-zinc-400 text-sm mb-6">{campaign.description}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
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
    </div>
  );
}
