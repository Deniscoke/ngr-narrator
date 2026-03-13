"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { RACE_ICONS, CLASS_ICONS } from "@/lib/dh-constants";
import { CharFancyCard, FancyCardTheme } from "@/components/ui/FancyCard";
import { characterRepo } from "@/lib/storage";
import { ROSTER_CAMPAIGN_ID } from "@/lib/roster";
import { getMyCampaigns, hasSupabase } from "@/lib/campaigns";
import type { Campaign } from "@/types";

function classToTheme(cls: string): FancyCardTheme {
  if (cls === "Válečník" || cls === "Alchymista") return "violet";
  if (cls === "Hraničář" || cls === "Zloděj") return "emerald";
  if (cls === "Klerik") return "gold";
  return "amber";
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ display_name?: string; avatar_url?: string } | null>(null);
  const [characters, setCharacters] = useState<Array<{
    id: string;
    name: string;
    race: string;
    class: string;
    level: number;
    hp?: number;
    maxHp?: number;
    stats?: Record<string, number>;
    portraitUrl?: string;
    campaignId: string;
  }>>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [supabaseOk, setSupabaseOk] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !key) {
      setLoading(false);
      return;
    }
    setSupabaseOk(true);

    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      setUser(u);
      if (!u) {
        setLoading(false);
        return;
      }
      const profilePromise = fetch("/api/profile").then((r) => r.json());
      const charsPromise = fetch("/api/characters?owner=me").then((r) => r.json());
      const rosterPromise = characterRepo.getAll({ campaignId: ROSTER_CAMPAIGN_ID } as { campaignId: string });
      const campaignsPromise = hasSupabase() ? getMyCampaigns(u.id) : Promise.resolve([]);

      Promise.all([profilePromise, charsPromise, rosterPromise, campaignsPromise]).then(
        ([profileRes, charsRes, localRoster, campaignList]) => {
          setProfile(profileRes.profile ?? null);
          const apiChars = charsRes.characters ?? [];
          const apiIds = new Set(apiChars.map((c: { id: string }) => c.id));
          const merged = [...apiChars, ...localRoster.filter((c) => !apiIds.has(c.id))];
          setCharacters(merged);
          setCampaigns(campaignList);
          setLoading(false);
        }
      ).catch(() => setLoading(false));
    });
  }, []);

  if (loading) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>Načítavam…</p>
      </div>
    );
  }

  if (!supabaseOk) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm" style={{ color: "var(--text-muted)" }}>
          Supabase nie je nakonfigurovaný. Profily vyžadujú prihlásenie cez Google.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="max-w-2xl">
        <div className="rounded-xl p-6 dh-card">
          <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
            Pre zobrazenie profilu sa musíš prihlásiť.
          </p>
          <Link href="/" className="dh-btn-primary inline-block px-4 py-2 rounded-lg text-sm font-medium">
            Prihlásiť sa cez Google
          </Link>
        </div>
      </div>
    );
  }

  const displayName = profile?.display_name ?? user.user_metadata?.full_name ?? user.user_metadata?.name ?? user.email?.split("@")[0] ?? "Hráč";
  const avatarUrl = profile?.avatar_url ?? user.user_metadata?.avatar_url;

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Môj profil</h1>

      <div className="rounded-xl p-6 mb-8 dh-card">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover" style={{ border: "2px solid var(--border-default)" }} />
          ) : (
            <div className="w-16 h-16 rounded-full flex items-center justify-center text-2xl" style={{ background: "var(--bg-panel)", border: "2px solid var(--border-default)" }}>
              👤
            </div>
          )}
          <div>
            <p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{displayName}</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>{user.email}</p>
          </div>
        </div>
      </div>

      {campaigns.length > 0 && (
        <section className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Moje kampane ({campaigns.length})
            </h2>
            <Link href="/app/campaigns" className="text-xs" style={{ color: "var(--accent-gold)" }}>
              Všetky kampane →
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {campaigns.map((c) => (
              <Link key={c.id} href={`/campaigns/${c.id}`} className="rounded-xl p-4 block dh-card hover:opacity-90 transition-opacity">
                <p className="font-medium" style={{ color: "var(--text-primary)" }}>{c.name}</p>
                {c.description && (
                  <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-muted)" }}>{c.description}</p>
                )}
                <p className="text-[10px] mt-2" style={{ color: "var(--text-dim)" }}>
                  {new Date(c.updatedAt || c.createdAt).toLocaleDateString("sk-SK")}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Moje postavy ({characters.length} / 5)
          </h2>
          <Link href="/app/characters" className="text-xs" style={{ color: "var(--accent-gold)" }}>
            Spravovať v Postavách →
          </Link>
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-dim)" }}>
          Postavy vytvorené v sekcii Postavy sa tu zobrazujú automaticky.
        </p>
        {characters.length === 0 ? (
          <div className="rounded-xl p-6 dh-card" style={{ borderStyle: "dashed" }}>
            <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>
              Zatiaľ nemáš žiadne postavy.
            </p>
            <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
              Vytvor si postavu v sekcii Postavy — zobrazí sa tu automaticky.
            </p>
            <Link href="/app/characters" className="text-sm" style={{ color: "var(--accent-gold)" }}>
              Vytvoriť postavu →
            </Link>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {characters.map((c) => (
              <Link key={c.id} href={c.campaignId === "__roster__" ? `/campaigns/__roster__/characters` : `/campaigns/${c.campaignId}/characters`}>
                <CharFancyCard
                  name={c.name}
                  race={c.race}
                  classname={c.class}
                  level={c.level}
                  hp={c.hp}
                  maxHp={c.maxHp}
                  stats={c.stats}
                  portraitUrl={c.portraitUrl}
                  raceIcon={RACE_ICONS[c.race] ?? "👤"}
                  classIcon={CLASS_ICONS[c.class] ?? "⚔️"}
                  theme={classToTheme(c.class)}
                  isNPC={false}
                />
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <Link href="/app/sien-slavy" className="text-sm" style={{ color: "var(--accent-gold)" }}>
          🏆 Sieň slávy — všetci hráči →
        </Link>
      </div>
    </div>
  );
}
