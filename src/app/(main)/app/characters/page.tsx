"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { characterRepo, campaignRepo } from "@/lib/storage";
import { Character, Campaign } from "@/types";
import { RACE_ICONS, CLASS_ICONS, GENDER_ICONS } from "@/lib/dh-constants";
import { CharFancyCard, FancyCardTheme } from "@/components/ui/FancyCard";
import { ClassSelector } from "@/components/ui/ClassSelector";
import { DHCharacterSheet, DHCharacterData } from "@/components/ui/DHCharacterSheet";
import { ROSTER_CAMPAIGN_ID } from "@/lib/roster";
import { createClient } from "@/lib/supabase/client";

const MAX_CHARACTERS = 5;

function classToTheme(cls: string): FancyCardTheme {
  if (cls === "Válečník" || cls === "Alchymista") return "violet";
  if (cls === "Hraničář"  || cls === "Zloděj")    return "emerald";
  if (cls === "Klerik")                            return "gold";
  return "amber";
}

function odoBonusFromValue(v: number): number {
  if (v <= 1)  return -5;
  if (v <= 3)  return -4;
  if (v <= 5)  return -3;
  if (v <= 7)  return -2;
  if (v <= 9)  return -1;
  if (v <= 11) return  0;
  if (v <= 13) return +1;
  if (v <= 15) return +2;
  if (v <= 17) return +3;
  if (v <= 19) return +4;
  if (v <= 21) return +5;
  return +6;
}

type ViewMode = "list" | "classSelect" | "sheet";

export default function CharactersGlobalPage() {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [campaigns,  setCampaigns]  = useState<Campaign[]>([]);
  const [view, setView] = useState<ViewMode>("list");
  const [classPreselect, setClassPreselect] = useState<{ name: string; class: string; race: string; gender: string } | null>(null);

  const reload = async () => {
    campaignRepo.getAll().then(setCampaigns);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [apiRes, localRoster] = await Promise.all([
          fetch("/api/characters?owner=me").then((r) => r.json()),
          characterRepo.getAll({ campaignId: ROSTER_CAMPAIGN_ID } as Partial<Character>),
        ]);
        const apiChars = apiRes.characters ?? [];
        const apiIds = new Set(apiChars.map((c: Character) => c.id));
        const merged = [...apiChars, ...localRoster.filter((c) => !apiIds.has(c.id))];
        setCharacters(merged);
      } else {
        characterRepo.getAll({ campaignId: ROSTER_CAMPAIGN_ID } as Partial<Character>).then(setCharacters);
      }
    } catch {
      characterRepo.getAll().then(setCharacters);
    }
  };
  useEffect(() => { reload(); }, []);

  const getCampaignName = (id: string) =>
    id === ROSTER_CAMPAIGN_ID ? "Roster" : (campaigns.find((c) => c.id === id)?.name ?? id.slice(0, 8));

  async function handleSheetSave(data: DHCharacterData) {
    if (characters.length >= MAX_CHARACTERS) {
      alert(`Maximálny počet postáv je ${MAX_CHARACTERS}. Zmaž niektorú postavu pred vytvorením novej.`);
      return;
    }
    const odo = data.stats.odolnost;
    const hp  = 10 + odoBonusFromValue(odo);
    const created = await characterRepo.create({
      campaignId: ROSTER_CAMPAIGN_ID,
      name:        data.name,
      race:        data.race,
      class:       data.class,
      gender:      data.gender,
      level:       data.level,
      stats:       data.stats as unknown as Record<string, number>,
      notes:       data.notes,
      isNPC:       data.isNPC,
      hp,
      maxHp:       hp,
      portraitUrl: data.portraitUrl,
      updatedAt:   new Date().toISOString(),
    });
    if (typeof window !== "undefined" && localStorage.getItem("dh_user_id")) {
      const res = await fetch("/api/characters", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(created) });
      if (!res.ok) {
        const text = await res.text();
        let err: { error?: string } = {};
        try { err = JSON.parse(text); } catch { /* not JSON */ }
        if (res.status === 400 && err.error) {
          await characterRepo.delete(created.id);
          alert(err.error);
          return;
        }
        console.warn("[characters] Sync to Supabase failed:", text);
      }
    }
    await reload();
    setView("list");
    setClassPreselect(null);
  }

  const pcs  = characters.filter((c) => !c.isNPC);
  const npcs = characters.filter((c) => c.isNPC);

  if (view === "classSelect") {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--bg-deep)" }}>
        <ClassSelector
          mode="create"
          onSelect={(ch) => { setClassPreselect(ch); setView("sheet"); }}
          onCancel={() => setView("list")}
        />
      </div>
    );
  }

  if (view === "sheet") {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "var(--bg-deep)" }}>
        <DHCharacterSheet
          initialClass={classPreselect?.class}
          initialRace={classPreselect?.race}
          initialGender={classPreselect?.gender}
          initialName={classPreselect?.name}
          onSave={handleSheetSave}
          onCancel={() => { setView("list"); setClassPreselect(null); }}
        />
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Postavy</h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
            {characters.length} / {MAX_CHARACTERS} postáv — zobrazujú sa aj v profile
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/app/campaigns"
            className="text-sm px-3 py-1.5 rounded-lg transition-colors"
            style={{ color: "var(--text-muted)", border: "1px solid var(--border-default)" }}
          >Kampane</Link>
          <button
            onClick={() => setView("classSelect")}
            disabled={characters.length >= MAX_CHARACTERS}
            className="text-sm px-3 py-1.5 rounded-lg transition-colors dh-btn-primary font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ border: "1px solid var(--border-accent)" }}
          >+ Nová postava</button>
        </div>
      </div>

      {characters.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ border: "1px dashed var(--border-default)" }}>
          <p className="text-3xl mb-3">🎭</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>Zatiaľ žiadne postavy.</p>
          <p className="text-xs mb-4" style={{ color: "var(--text-dim)" }}>
            Vytvor si postavu — zobrazí sa aj v profile. Max. {MAX_CHARACTERS} postáv.
          </p>
          <button
            onClick={() => setView("classSelect")}
            className="text-sm px-4 py-2 rounded-lg dh-btn-primary font-semibold"
            style={{ color: "var(--accent-gold)" }}
          >Vytvoriť postavu →</button>
        </div>
      ) : (
        <>
        {characters.length >= MAX_CHARACTERS && (
          <div className="rounded-xl p-3 mb-4 dh-card" style={{ borderStyle: "dashed" }}>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>
              Dosiahol si limit {MAX_CHARACTERS} postáv. Zmaž niektorú pred vytvorením novej.
            </p>
          </div>
        )}
        <div className="space-y-8">
          {pcs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                Hrdinovia ({pcs.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pcs.map((c) => (
                  <CharCard key={c.id} character={c} campaignName={getCampaignName(c.campaignId)} />
                ))}
              </div>
            </section>
          )}

          {npcs.length > 0 && (
            <section>
              <h2 className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: "var(--text-muted)" }}>
                NPC ({npcs.length})
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {npcs.map((c) => (
                  <CharCard key={c.id} character={c} campaignName={getCampaignName(c.campaignId)} />
                ))}
              </div>
            </section>
          )}
        </div>
        </>
      )}
    </div>
  );
}

function CharCard({ character: c, campaignName }: { character: Character; campaignName: string }) {
  const href = c.campaignId === ROSTER_CAMPAIGN_ID
    ? `/campaigns/${ROSTER_CAMPAIGN_ID}/characters`
    : `/campaigns/${c.campaignId}/characters`;
  return (
    <a href={href} className="block">
      <CharFancyCard
        name={c.name}
        race={c.race ?? ""}
        classname={c.class ?? ""}
        gender={c.gender}
        level={c.level ?? 1}
        hp={c.hp}
        maxHp={c.maxHp}
        stats={c.stats}
        portraitUrl={c.portraitUrl}
        raceIcon={RACE_ICONS[c.race ?? ""] ?? "👤"}
        classIcon={CLASS_ICONS[c.class ?? ""] ?? "⚔️"}
        genderIcon={GENDER_ICONS[c.gender ?? ""] ?? ""}
        theme={classToTheme(c.class ?? "")}
        isNPC={c.isNPC}
        statuses={c.statuses}
        injuries={c.injuries}
        notes={c.notes ?? campaignName}
      />
    </a>
  );
}
