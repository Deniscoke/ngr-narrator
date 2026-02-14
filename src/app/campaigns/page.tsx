"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { campaignRepo, sessionRepo, characterRepo } from "@/lib/storage";
import { Campaign } from "@/types";

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  const reload = () => campaignRepo.getAll().then(setCampaigns);
  useEffect(() => { reload(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    await campaignRepo.create({
      name: name.trim(),
      description: desc.trim(),
      rulesetId: "generic",
      updatedAt: new Date().toISOString(),
    });
    setName("");
    setDesc("");
    reload();
  }

  async function handleDelete(id: string) {
    if (!confirm("Naozaj chceš zmazať túto kampaň? Zmažú sa aj všetky jej postavy a sedenia.")) return;
    const chars = await characterRepo.getAll({ campaignId: id } as never);
    for (const ch of chars) await characterRepo.delete(ch.id);
    const sessions = await sessionRepo.getAll({ campaignId: id } as never);
    for (const s of sessions) await sessionRepo.delete(s.id);
    await campaignRepo.delete(id);
    reload();
  }

  function startEdit(c: Campaign) {
    setEditingId(c.id);
    setEditName(c.name);
    setEditDesc(c.description);
  }

  async function handleSaveEdit() {
    if (!editingId || !editName.trim()) return;
    await campaignRepo.update(editingId, {
      name: editName.trim(),
      description: editDesc.trim(),
    });
    setEditingId(null);
    reload();
  }

  const inputClass =
    "w-full bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500";

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold text-zinc-100 mb-6">Kampane</h1>

      <form onSubmit={handleCreate} className="mb-8 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Názov kampane" className={inputClass} />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Popis (voliteľné)" className={inputClass} />
        <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-black font-medium text-sm px-4 py-2 rounded transition-colors">
          + Nová kampaň
        </button>
      </form>

      <div className="space-y-2">
        {campaigns.length === 0 && (
          <p className="text-zinc-500 text-sm">Zatiaľ žiadne kampane.</p>
        )}
        {campaigns.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="border border-amber-500/50 rounded-lg p-4 space-y-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Popis" className={inputClass} />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="bg-amber-600 hover:bg-amber-500 text-black font-medium text-sm px-3 py-1.5 rounded transition-colors">
                  Uložiť
                </button>
                <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300 text-sm px-3 py-1.5 transition-colors">
                  Zrušiť
                </button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="flex items-center justify-between border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
              <Link href={`/campaigns/${c.id}`} className="flex-1">
                <p className="text-zinc-200 font-medium">{c.name}</p>
                {c.description && <p className="text-sm text-zinc-500 mt-1">{c.description}</p>}
              </Link>
              <div className="flex gap-3 ml-4">
                <button onClick={() => startEdit(c)} className="text-zinc-500 hover:text-amber-400 text-sm transition-colors">
                  Upraviť
                </button>
                <button onClick={() => handleDelete(c.id)} className="text-zinc-600 hover:text-red-400 text-sm transition-colors">
                  Zmazať
                </button>
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}
