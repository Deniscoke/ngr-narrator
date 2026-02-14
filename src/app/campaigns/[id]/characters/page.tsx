"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { characterRepo } from "@/lib/storage";
import { Character } from "@/types";

const DEFAULT_STATS = { strength: 0, dexterity: 0, intelligence: 0 };

const inputClass =
  "bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500";
const smallInputClass = inputClass + " w-20 text-center";

export default function CharactersPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [characters, setCharacters] = useState<Character[]>([]);
  const [name, setName] = useState("");
  const [race, setRace] = useState("");
  const [charClass, setCharClass] = useState("");
  const [isNPC, setIsNPC] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<Character>>({});

  const reload = () => {
    if (!campaignId) return;
    characterRepo.getAll({ campaignId } as Partial<Character>).then(setCharacters);
  };
  useEffect(() => { reload(); }, [campaignId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !campaignId) return;
    await characterRepo.create({
      campaignId,
      name: name.trim(),
      race: race.trim(),
      class: charClass.trim(),
      level: 1,
      stats: { ...DEFAULT_STATS },
      notes: "",
      isNPC,
      updatedAt: new Date().toISOString(),
    });
    setName(""); setRace(""); setCharClass(""); setIsNPC(false);
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Zmazať túto postavu?")) return;
    await characterRepo.delete(id);
    reload();
  }

  function startEdit(c: Character) {
    setEditingId(c.id);
    setEditForm({
      name: c.name, race: c.race, class: c.class,
      level: c.level, notes: c.notes, isNPC: c.isNPC,
      stats: { ...DEFAULT_STATS, ...c.stats },
    });
  }

  async function handleSaveEdit() {
    if (!editingId || !editForm.name?.trim()) return;
    await characterRepo.update(editingId, {
      name: editForm.name.trim(),
      race: editForm.race?.trim() ?? "",
      class: editForm.class?.trim() ?? "",
      level: editForm.level ?? 1,
      notes: editForm.notes ?? "",
      isNPC: editForm.isNPC ?? false,
      stats: editForm.stats ?? DEFAULT_STATS,
    });
    setEditingId(null);
    reload();
  }

  function updateEditStat(key: string, val: string) {
    const num = parseInt(val, 10);
    setEditForm((f) => ({
      ...f,
      stats: { ...DEFAULT_STATS, ...f.stats, [key]: isNaN(num) ? 0 : num },
    }));
  }

  const pcs = characters.filter((c) => !c.isNPC);
  const npcs = characters.filter((c) => c.isNPC);

  return (
    <div className="max-w-3xl">
      <Link href={`/campaigns/${campaignId}`} className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block">
        ← Späť
      </Link>

      <h1 className="text-xl font-bold text-zinc-100 mb-6">Postavy</h1>

      <form onSubmit={handleCreate} className="mb-8 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Meno" className={inputClass} />
          <input value={race} onChange={(e) => setRace(e.target.value)} placeholder="Rasa" className={inputClass} />
          <input value={charClass} onChange={(e) => setCharClass(e.target.value)} placeholder="Povolanie" className={inputClass} />
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input type="checkbox" checked={isNPC} onChange={(e) => setIsNPC(e.target.checked)} className="rounded" />
            NPC
          </label>
          <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-black font-medium text-sm px-4 py-2 rounded transition-colors">
            + Pridať postavu
          </button>
        </div>
      </form>

      {pcs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Hráčske postavy</h2>
          <div className="space-y-2">{pcs.map((c) => (
            <CharacterCard key={c.id} character={c} isEditing={editingId === c.id} editForm={editForm}
              onEdit={() => startEdit(c)} onDelete={() => handleDelete(c.id)} onCancel={() => setEditingId(null)}
              onSave={handleSaveEdit} onEditChange={setEditForm} onStatChange={updateEditStat} />
          ))}</div>
        </div>
      )}

      {npcs.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-zinc-400 mb-2 uppercase tracking-wider">NPC</h2>
          <div className="space-y-2">{npcs.map((c) => (
            <CharacterCard key={c.id} character={c} isEditing={editingId === c.id} editForm={editForm}
              onEdit={() => startEdit(c)} onDelete={() => handleDelete(c.id)} onCancel={() => setEditingId(null)}
              onSave={handleSaveEdit} onEditChange={setEditForm} onStatChange={updateEditStat} />
          ))}</div>
        </div>
      )}

      {characters.length === 0 && <p className="text-zinc-500 text-sm">Žiadne postavy.</p>}
    </div>
  );
}

function CharacterCard({
  character: c, isEditing, editForm,
  onEdit, onDelete, onCancel, onSave, onEditChange, onStatChange,
}: {
  character: Character; isEditing: boolean; editForm: Partial<Character>;
  onEdit: () => void; onDelete: () => void; onCancel: () => void; onSave: () => void;
  onEditChange: (f: Partial<Character>) => void; onStatChange: (key: string, val: string) => void;
}) {
  const stats = { ...DEFAULT_STATS, ...c.stats };

  if (isEditing) {
    const eStats = { ...DEFAULT_STATS, ...(editForm.stats as Record<string, number>) };
    return (
      <div className="border border-amber-500/50 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-2">
          <input value={editForm.name ?? ""} onChange={(e) => onEditChange({ ...editForm, name: e.target.value })} placeholder="Meno" className={inputClass} />
          <input value={editForm.race ?? ""} onChange={(e) => onEditChange({ ...editForm, race: e.target.value })} placeholder="Rasa" className={inputClass} />
          <input value={editForm.class ?? ""} onChange={(e) => onEditChange({ ...editForm, class: e.target.value })} placeholder="Povolanie" className={inputClass} />
        </div>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-xs text-zinc-400">
            Úroveň
            <input type="number" min={1} max={99} value={editForm.level ?? 1}
              onChange={(e) => onEditChange({ ...editForm, level: parseInt(e.target.value) || 1 })}
              className={smallInputClass + " ml-2"} />
          </label>
          <label className="text-xs text-zinc-400">SIL <input type="number" value={eStats.strength} onChange={(e) => onStatChange("strength", e.target.value)} className={smallInputClass + " ml-1"} /></label>
          <label className="text-xs text-zinc-400">OBR <input type="number" value={eStats.dexterity} onChange={(e) => onStatChange("dexterity", e.target.value)} className={smallInputClass + " ml-1"} /></label>
          <label className="text-xs text-zinc-400">INT <input type="number" value={eStats.intelligence} onChange={(e) => onStatChange("intelligence", e.target.value)} className={smallInputClass + " ml-1"} /></label>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input type="checkbox" checked={editForm.isNPC ?? false} onChange={(e) => onEditChange({ ...editForm, isNPC: e.target.checked })} />
            NPC
          </label>
        </div>
        <textarea value={editForm.notes ?? ""} onChange={(e) => onEditChange({ ...editForm, notes: e.target.value })}
          placeholder="Poznámky..." rows={2} className={inputClass + " w-full resize-y"} />
        <div className="flex gap-2">
          <button onClick={onSave} className="bg-amber-600 hover:bg-amber-500 text-black font-medium text-sm px-3 py-1.5 rounded transition-colors">Uložiť</button>
          <button onClick={onCancel} className="text-zinc-500 hover:text-zinc-300 text-sm px-3 py-1.5 transition-colors">Zrušiť</button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-zinc-800 rounded-lg p-3 space-y-1">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-zinc-200 text-sm font-medium">{c.name}</p>
          <p className="text-xs text-zinc-500">
            {[c.race, c.class, `Úroveň ${c.level}`].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onEdit} className="text-zinc-500 hover:text-amber-400 text-sm transition-colors">Upraviť</button>
          <button onClick={onDelete} className="text-zinc-600 hover:text-red-400 text-sm transition-colors">×</button>
        </div>
      </div>
      <div className="flex gap-4 text-xs text-zinc-500 pt-1">
        <span>SIL {stats.strength}</span>
        <span>OBR {stats.dexterity}</span>
        <span>INT {stats.intelligence}</span>
      </div>
      {c.notes && <p className="text-xs text-zinc-500 italic pt-1">{c.notes}</p>}
    </div>
  );
}
