"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { characterRepo } from "@/lib/storage";
import { Character } from "@/types";
import { ROSTER_CAMPAIGN_ID } from "@/lib/roster";
import { createClient } from "@/lib/supabase/client";
import { RACE_ICONS, CLASS_ICONS, GENDER_ICONS } from "@/lib/dh-constants";
import { CharFancyCard, FancyCardTheme } from "@/components/ui/FancyCard";
import { LevelUpModal } from "@/components/ui/LevelUpModal";
import { SpecializationModal } from "@/components/ui/SpecializationModal";
import type { SpecializationOption } from "@/lib/dh-progressions";
import {
  fetchCharacters,
  insertCharacter,
  deleteCharacter,
  updateCharacter,
} from "@/lib/campaigns/campaign-content-live";

const SB_AVAILABLE = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
);

function classToTheme(cls: string): FancyCardTheme {
  if (cls === "Válečník" || cls === "Alchymista") return "amber";
  if (cls === "Hraničář"  || cls === "Zloděj")    return "emerald";
  if (cls === "Klerik")                            return "gold";
  return "amber";
}

/* ── Page ────────────────────────────────────────── */
export default function CharactersPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [rosterChars, setRosterChars] = useState<Character[]>([]);
  const [rosterModalOpen, setRosterModalOpen] = useState(false);
  const [editingId,  setEditingId]  = useState<string | null>(null);
  const [editChar,   setEditChar]   = useState<Character | null>(null);
  const [levelUpChar, setLevelUpChar] = useState<Character | null>(null);
  const [specializeChar, setSpecializeChar] = useState<Character | null>(null);

  const isRoster = campaignId === ROSTER_CAMPAIGN_ID;

  const reload = async () => {
    if (!campaignId) return;

    if (!isRoster && SB_AVAILABLE) {
      // Campaign characters → Supabase is the source of truth
      try {
        const chars = await fetchCharacters(campaignId);
        setCharacters(chars);
      } catch (err) {
        console.error("[characters] fetchCharacters failed:", err);
        // Fallback to localStorage
        const chars = await characterRepo.getAll({ campaignId } as Partial<Character>);
        setCharacters(chars);
      }
    } else {
      // Roster or no Supabase → localStorage
      const chars = await characterRepo.getAll({ campaignId } as Partial<Character>);
      setCharacters(chars);
    }

    // Roster (profile characters) always from localStorage + API merge
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const [apiRes, localChars] = await Promise.all([
          fetch("/api/characters?owner=me").then((r) => r.json()),
          characterRepo.getAll({ campaignId: ROSTER_CAMPAIGN_ID } as Partial<Character>),
        ]);
        const apiChars = apiRes.characters ?? [];
        const apiIds = new Set(apiChars.map((c: Character) => c.id));
        const merged = [...apiChars, ...localChars.filter((c) => !apiIds.has(c.id))];
        setRosterChars(merged);
      } else {
        characterRepo.getAll({ campaignId: ROSTER_CAMPAIGN_ID } as Partial<Character>).then(setRosterChars);
      }
    } catch {
      characterRepo.getAll({ campaignId: ROSTER_CAMPAIGN_ID } as Partial<Character>).then(setRosterChars);
    }
  };

  useEffect(() => { void reload(); }, [campaignId]);

  /* level up */
  async function handleLevelUp(id: string, updates: { hpBonus: number; statKey: string }) {
    const c = characters.find((x) => x.id === id);
    if (!c) return;
    const stats = { ...(c.stats ?? {}) };
    stats[updates.statKey] = (stats[updates.statKey] ?? 0) + 1;
    const newHp = (c.hp ?? c.maxHp ?? 0) + updates.hpBonus;
    const newMaxHp = (c.maxHp ?? 0) + updates.hpBonus;
    const patch = {
      level: (c.level ?? 1) + 1,
      hp: newHp,
      maxHp: newMaxHp,
      stats,
    };
    if (!isRoster && SB_AVAILABLE) {
      await updateCharacter(id, patch);
    } else {
      await characterRepo.update(id, { ...patch, updatedAt: new Date().toISOString() });
    }
    setLevelUpChar(null);
    reload();
  }

  /* specialization */
  async function handleSpecializationSelect(spec: SpecializationOption) {
    if (!specializeChar) return;
    const stats = { ...(specializeChar.stats ?? {}) };
    if (spec.statBonus) {
      stats[spec.statBonus] = (stats[spec.statBonus] ?? 0) + 1;
    }
    const patch = { specialization: spec.name, stats };
    if (!isRoster && SB_AVAILABLE) {
      await updateCharacter(specializeChar.id, patch);
    } else {
      await characterRepo.update(specializeChar.id, { ...patch, updatedAt: new Date().toISOString() });
    }
    setSpecializeChar(null);
    reload();
  }

  /* delete */
  async function handleDelete(id: string) {
    if (!confirm("Smazat tuto postavu?")) return;
    if (!isRoster && SB_AVAILABLE) {
      await deleteCharacter(id);
    } else {
      await characterRepo.delete(id);
    }
    reload();
  }

  /* add from roster — copy into campaign via Supabase */
  async function addFromRoster(rosterChar: Character) {
    if (!campaignId) return;
    const { id: _omit, createdAt: _c, updatedAt: _u, campaignId: _cid, ...rest } = rosterChar;

    if (SB_AVAILABLE) {
      try {
        const created = await insertCharacter({ ...rest, campaignId });
        if (!created) throw new Error("Postava nebola vytvorená");
      } catch (err) {
        const msg = err instanceof Error
          ? err.message
          : (err as { message?: string })?.message ?? JSON.stringify(err);
        console.error("[addFromRoster] Supabase error:", err);
        alert(`Nepodařilo se přidat postavu: ${msg}`);
        return;
      }
    } else {
      await characterRepo.create({ ...rest, campaignId, updatedAt: new Date().toISOString() });
    }
    setRosterModalOpen(false);
    reload();
  }

  /* inline edit */
  function startEdit(c: Character) {
    setEditingId(c.id);
    setEditChar({ ...c });
  }

  async function saveEdit() {
    if (!editingId || !editChar?.name?.trim()) return;
    const patch = {
      name:  editChar.name.trim(),
      race:  editChar.race ?? "",
      class: editChar.class ?? "",
      level: editChar.level ?? 1,
      notes: editChar.notes ?? "",
      isNPC: editChar.isNPC ?? false,
      stats: editChar.stats ?? {},
    };
    if (!isRoster && SB_AVAILABLE) {
      await updateCharacter(editingId, patch);
    } else {
      await characterRepo.update(editingId, { ...patch, updatedAt: new Date().toISOString() });
    }
    setEditingId(null);
    setEditChar(null);
    reload();
  }

  const pcs  = characters.filter(c => !c.isNPC);
  const npcs = characters.filter(c => c.isNPC);

  /* ── LIST VIEW ─────────────────────────────────── */
  return (
    <div className="max-w-3xl">
      {/* header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link
            href={isRoster ? "/app/characters" : `/app/campaigns/${campaignId}`}
            className="text-sm mb-1 inline-block transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            ← {isRoster ? "Zpět na postavy" : "Zpět na kampaň"}
          </Link>
          <h1 className="text-xl font-bold" style={{ color: "var(--text-primary)" }}>Postavy</h1>
        </div>
        <div className="flex gap-2">
          {!isRoster && (
            <button onClick={() => setRosterModalOpen(true)}
              className="flex items-center gap-2 font-medium text-sm px-3 py-2 rounded-lg transition-all dh-btn-primary"
            >
              👤 Vybrat z profilu
            </button>
          )}
          {isRoster && (
            <Link
              href="/app/characters"
              className="flex items-center gap-2 font-medium text-sm px-3 py-2 rounded-lg transition-all dh-btn-primary"
            >
              + Vytvořit postavu
            </Link>
          )}
        </div>
      </div>

      {/* Roster modal */}
      {rosterModalOpen && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setRosterModalOpen(false)}>
          <div className="rounded-xl p-6 w-full max-w-lg max-h-[80vh] overflow-hidden flex flex-col" style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)" }} onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>Vyberte postavu z profilu</h3>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>Vyber postavu — všechny údaje (atributy, HP, inventář, poznámky) se zkopírují do kampaně.</p>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {rosterChars.length === 0 ? (
                <p className="text-sm py-4 text-center" style={{ color: "var(--text-muted)" }}>Profil je prázdný. Vytvoř postavy v sekci Postavy.</p>
              ) : (
                rosterChars.map((rc) => (
                  <button
                    key={rc.id}
                    onClick={() => addFromRoster(rc)}
                    className="w-full text-left p-3 rounded-lg transition-colors flex items-center gap-3 dh-input"
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center text-lg" style={{ background: "var(--bg-panel)" }}>
                      {CLASS_ICONS[rc.class ?? ""] ?? "⚔️"}
                    </div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{rc.name}</p>
                      <p className="text-xs" style={{ color: "var(--text-muted)" }}>{rc.race} · {rc.class} · Úr. {rc.level}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
            <button onClick={() => setRosterModalOpen(false)} className="mt-4 text-sm transition-colors" style={{ color: "var(--text-muted)" }}>
              Zrušit
            </button>
          </div>
        </div>
      )}

      {/* PC section */}
      {pcs.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
            Hrdinové ({pcs.length})
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {pcs.map(c => (
              <CharacterCard key={c.id} character={c}
                isEditing={editingId === c.id} editChar={editChar}
                onEdit={() => startEdit(c)}
                onDelete={() => handleDelete(c.id)}
                onLevelUp={() => setLevelUpChar(c)}
                onSpecialize={() => setSpecializeChar(c)}
                onCancel={() => { setEditingId(null); setEditChar(null); }}
                onSave={saveEdit}
                onChange={setEditChar}
              />
            ))}
          </div>
        </section>
      )}

      {/* NPC section */}
      {npcs.length > 0 && (
        <section className="mb-6">
          <h2 className="text-xs font-semibold mb-3 uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>NPC ({npcs.length})</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {npcs.map(c => (
              <CharacterCard key={c.id} character={c}
                isEditing={editingId === c.id} editChar={editChar}
                onEdit={() => startEdit(c)}
                onDelete={() => handleDelete(c.id)}
                onLevelUp={() => setLevelUpChar(c)}
                onSpecialize={() => setSpecializeChar(c)}
                onCancel={() => { setEditingId(null); setEditChar(null); }}
                onSave={saveEdit}
                onChange={setEditChar}
              />
            ))}
          </div>
        </section>
      )}

      {/* Specialization modal */}
      {specializeChar && (
        <SpecializationModal
          character={specializeChar}
          onSelect={handleSpecializationSelect}
          onCancel={() => setSpecializeChar(null)}
        />
      )}

      {/* Level-up modal */}
      {levelUpChar && (
        <LevelUpModal
          character={levelUpChar}
          onApply={(updates) => handleLevelUp(levelUpChar.id, updates)}
          onCancel={() => setLevelUpChar(null)}
        />
      )}

      {characters.length === 0 && (
        <div className="text-center py-16 rounded-xl" style={{ border: "1px dashed var(--border-default)" }}>
          <p className="text-3xl mb-3">🎭</p>
          <p className="text-sm mb-4" style={{ color: "var(--text-muted)" }}>
            {isRoster ? "Žádné postavy v rosteru." : "Žádné postavy v této kampani."}
          </p>
          {isRoster ? (
            <Link href="/app/characters" className="text-sm underline underline-offset-2" style={{ color: "var(--accent-gold)" }}>
              Vytvořit postavu v Postavách →
            </Link>
          ) : (
            <button onClick={() => setRosterModalOpen(true)} className="text-sm underline underline-offset-2" style={{ color: "var(--accent-gold)" }}>
              Vybrat z profilu →
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Character card ──────────────────────────────── */
const STAT_DISPLAY = [
  { k:"sila",        l:"SIL" },
  { k:"obratnost",   l:"OBR" },
  { k:"odolnost",    l:"ODO" },
  { k:"inteligence", l:"INT" },
  { k:"charisma",    l:"CHA" },
];

function CharacterCard({ character: c, isEditing, editChar, onEdit, onDelete, onLevelUp, onSpecialize, onCancel, onSave, onChange }: {
  character:  Character;
  isEditing:  boolean;
  editChar:   Character | null;
  onEdit:    () => void;
  onDelete:  () => void;
  onLevelUp?: () => void;
  onSpecialize?: () => void;
  onCancel:  () => void;
  onSave:    () => void;
  onChange:  (c: Character) => void;
}) {
  const inp = "rounded px-2 py-1.5 text-xs w-full dh-input";

  if (isEditing && editChar) {
    return (
      <div className="rounded-xl p-4 space-y-3" style={{ border: "1px solid var(--border-accent)", background: "var(--bg-panel)" }}>
        <input value={editChar.name ?? ""} onChange={e => onChange({ ...editChar, name: e.target.value })}
          placeholder="Jméno" className={inp} />
        <div className="grid grid-cols-2 gap-2">
          <input value={editChar.race ?? ""}  onChange={e => onChange({ ...editChar, race: e.target.value })}  placeholder="Rasa"      className={inp} />
          <input value={editChar.class ?? ""} onChange={e => onChange({ ...editChar, class: e.target.value })} placeholder="Povolanie" className={inp} />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {STAT_DISPLAY.map(({ k, l }) => (
            <label key={k} className="text-[10px] text-zinc-500">
              {l}
              <input type="number" value={editChar.stats?.[k] ?? 0}
                onChange={e => onChange({ ...editChar, stats: { ...editChar.stats, [k]: parseInt(e.target.value)||0 } })}
                className={inp + " mt-0.5 text-center"} />
            </label>
          ))}
        </div>
        <textarea value={editChar.notes ?? ""} onChange={e => onChange({ ...editChar, notes: e.target.value })}
          placeholder="Poznámky…" rows={2} className={inp + " resize-y"} />
        <div className="flex gap-2">
          <button onClick={onSave}   className="dh-btn-primary font-semibold text-xs px-3 py-1.5 rounded transition-colors">Uložiť</button>
          <button onClick={onCancel} className="text-xs px-3 py-1.5 transition-colors" style={{ color: "var(--text-muted)" }}>Zrušit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative">
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
        notes={c.notes}
        specialization={c.specialization}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      {!c.isNPC && (
        <div className="absolute bottom-3 right-3 flex gap-1">
          {onSpecialize && (
            <button
              onClick={onSpecialize}
              className="text-[10px] px-2 py-1 rounded transition-colors"
              style={{ background: "rgba(139,115,150,0.3)", color: "#c4b0d4" }}
            >
              ⚡ Vylepšiť
            </button>
          )}
          {onLevelUp && (
            <button
              onClick={onLevelUp}
              className="text-[10px] px-2 py-1 rounded transition-colors"
              style={{ background: "rgba(201,162,39,0.3)", color: "#e8d4a8" }}
            >
              ↑ Postup
            </button>
          )}
        </div>
      )}
    </div>
  );
}
