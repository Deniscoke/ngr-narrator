"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { campaignRepo, sessionRepo, characterRepo, narrationRepo, memoryRepo, campaignStateRepo } from "@/lib/storage";
import { Campaign } from "@/types";
import { hashPassword, verifyPassword } from "@/lib/security/password";

// Session-level unlock flags (lost on page refresh)
const unlockedCampaigns = new Set<string>();

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Password modal state
  const [pwModal, setPwModal] = useState<{
    campaignId: string;
    purpose: "enter" | "delete";
  } | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const pwRef = useRef<HTMLInputElement>(null);

  const reload = () => campaignRepo.getAll().then(setCampaigns);
  useEffect(() => { reload(); }, []);

  useEffect(() => {
    if (pwModal && pwRef.current) pwRef.current.focus();
  }, [pwModal]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    const extra: Partial<Campaign> = {};
    if (password.trim()) {
      const { hash, salt } = await hashPassword(password.trim());
      extra.passwordHash = hash;
      extra.passwordSalt = salt;
    }

    const created = await campaignRepo.create({
      name: name.trim(),
      description: desc.trim(),
      rulesetId: "generic",
      updatedAt: new Date().toISOString(),
      ...extra,
    });
    // Auto-unlock just-created campaign
    unlockedCampaigns.add(created.id);

    setName("");
    setDesc("");
    setPassword("");
    reload();
  }

  // Full campaign data wipe
  async function wipeCampaign(id: string) {
    const chars = await characterRepo.getAll({ campaignId: id } as never);
    for (const ch of chars) await characterRepo.delete(ch.id);
    const sessions = await sessionRepo.getAll({ campaignId: id } as never);
    for (const s of sessions) await sessionRepo.delete(s.id);
    const narrations = await narrationRepo.getAll({ campaignId: id } as never);
    for (const n of narrations) await narrationRepo.delete(n.id);
    const memories = await memoryRepo.getAll({ campaignId: id } as never);
    for (const m of memories) await memoryRepo.delete(m.id);
    const states = await campaignStateRepo.getAll({ campaignId: id } as never);
    for (const st of states) await campaignStateRepo.delete(st.id);
    await campaignRepo.delete(id);
    unlockedCampaigns.delete(id);
    reload();
  }

  function handleCampaignClick(c: Campaign) {
    if (c.passwordHash && !unlockedCampaigns.has(c.id)) {
      setPwModal({ campaignId: c.id, purpose: "enter" });
      setPwInput("");
      setPwError("");
      return;
    }
    router.push(`/campaigns/${c.id}`);
  }

  function handleDeleteClick(c: Campaign) {
    if (c.passwordHash) {
      setPwModal({ campaignId: c.id, purpose: "delete" });
      setPwInput("");
      setPwError("");
      return;
    }
    if (!confirm("Opravdu chceš smazat tuto kampaň? Smaže se vše — postavy, sezení, historie.")) return;
    wipeCampaign(c.id);
  }

  async function handlePwSubmit() {
    if (!pwModal) return;
    const c = campaigns.find((x) => x.id === pwModal.campaignId);
    if (!c || !c.passwordHash || !c.passwordSalt) return;

    const ok = await verifyPassword(pwInput, c.passwordHash, c.passwordSalt);
    if (!ok) {
      setPwError("Nesprávné heslo.");
      return;
    }

    unlockedCampaigns.add(c.id);

    if (pwModal.purpose === "enter") {
      setPwModal(null);
      router.push(`/campaigns/${c.id}`);
    } else {
      setPwModal(null);
      wipeCampaign(c.id);
    }
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
      <h1 className="text-xl font-bold text-zinc-100 mb-6">Kampaně</h1>

      <form onSubmit={handleCreate} className="mb-8 space-y-3">
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Název kampaně" className={inputClass} />
        <input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Popis (volitelné)" className={inputClass} />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Heslo kampaně (volitelné)"
          className={inputClass}
          autoComplete="new-password"
        />
        <button type="submit" className="bg-amber-600 hover:bg-amber-500 text-black font-medium text-sm px-4 py-2 rounded transition-colors">
          + Nová kampaň
        </button>
      </form>

      <div className="space-y-2">
        {campaigns.length === 0 && (
          <p className="text-zinc-500 text-sm">Zatím žádné kampaně.</p>
        )}
        {campaigns.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="border border-amber-500/50 rounded-lg p-4 space-y-2">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Popis" className={inputClass} />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="bg-amber-600 hover:bg-amber-500 text-black font-medium text-sm px-3 py-1.5 rounded transition-colors">
                  Uložit
                </button>
                <button onClick={() => setEditingId(null)} className="text-zinc-500 hover:text-zinc-300 text-sm px-3 py-1.5 transition-colors">
                  Zrušit
                </button>
              </div>
            </div>
          ) : (
            <div key={c.id} className="flex items-center justify-between border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
              <button onClick={() => handleCampaignClick(c)} className="flex-1 text-left">
                <div className="flex items-center gap-2">
                  {c.passwordHash && (
                    <span className="text-amber-500 text-xs" title="Zamčená kampaň">🔒</span>
                  )}
                  <p className="text-zinc-200 font-medium">{c.name}</p>
                  <span className="text-[10px] text-zinc-600 font-mono">{c.id.slice(0, 8)}</span>
                </div>
                {c.description && <p className="text-sm text-zinc-500 mt-1">{c.description}</p>}
              </button>
              <div className="flex gap-3 ml-4">
                <button onClick={() => startEdit(c)} className="text-zinc-500 hover:text-amber-400 text-sm transition-colors">
                  Upravit
                </button>
                <button onClick={() => handleDeleteClick(c)} className="text-zinc-600 hover:text-red-400 text-sm transition-colors">
                  Smazat
                </button>
              </div>
            </div>
          )
        )}
      </div>

      {/* Password modal */}
      {pwModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50" onClick={() => setPwModal(null)}>
          <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 w-80 max-w-[90vw]" onClick={(e) => e.stopPropagation()}>
            <p className="text-sm text-zinc-200 font-medium mb-1">
              {pwModal.purpose === "enter" ? "Zadej heslo kampaně" : "Potvrď heslem pro smazání"}
            </p>
            <p className="text-xs text-zinc-500 mb-4">
              {pwModal.purpose === "delete" && "Smazání odstraní vše — postavy, sezení, celou historii."}
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handlePwSubmit();
              }}
            >
              <input
                ref={pwRef}
                type="password"
                value={pwInput}
                onChange={(e) => { setPwInput(e.target.value); setPwError(""); }}
                placeholder="Heslo"
                className={inputClass + " mb-3"}
                autoComplete="current-password"
              />
              {pwError && <p className="text-xs text-red-400 mb-2">{pwError}</p>}
              <div className="flex gap-2">
                <button
                  type="submit"
                  className={`text-sm font-medium px-4 py-2 rounded transition-colors ${
                    pwModal.purpose === "delete"
                      ? "bg-red-700 hover:bg-red-600 text-white"
                      : "bg-amber-600 hover:bg-amber-500 text-black"
                  }`}
                >
                  {pwModal.purpose === "enter" ? "Odemknout" : "Smazat"}
                </button>
                <button
                  type="button"
                  onClick={() => setPwModal(null)}
                  className="text-zinc-500 hover:text-zinc-300 text-sm px-3 py-2 transition-colors"
                >
                  Zrušit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
