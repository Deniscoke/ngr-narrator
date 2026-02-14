"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { campaignRepo } from "@/lib/storage";
import { Campaign } from "@/types";

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);

  useEffect(() => {
    campaignRepo.getAll().then(setCampaigns);
  }, []);

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold text-zinc-100 mb-2">
        Vitaj v RPG Narrator Engine
      </h1>
      <p className="text-zinc-400 mb-8">
        Spravuj kampane, postavy, sedenia a poznámky. Všetko lokálne v
        prehliadači.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/campaigns"
          className="border border-zinc-800 rounded-lg p-4 hover:border-amber-500/50 transition-colors"
        >
          <p className="text-amber-400 font-semibold mb-1">📜 Kampane</p>
          <p className="text-sm text-zinc-500">
            {campaigns.length} aktívnych kampaní
          </p>
        </Link>

        <Link
          href="/rules"
          className="border border-zinc-800 rounded-lg p-4 hover:border-amber-500/50 transition-colors"
        >
          <p className="text-amber-400 font-semibold mb-1">📖 Pravidlá</p>
          <p className="text-sm text-zinc-500">
            Knižnica pravidiel (štruktúra)
          </p>
        </Link>
      </div>
    </div>
  );
}
