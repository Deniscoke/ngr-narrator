"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { campaignRepo, sessionRepo, characterRepo, narrationRepo, memoryRepo, campaignStateRepo } from "@/lib/storage";
import { getMyCampaigns, createCampaign, joinCampaign, hasSupabase } from "@/lib/campaigns";
import { Campaign } from "@/types";
import { hashPassword, verifyPassword } from "@/lib/security/password";
import { FancyCard } from "@/components/ui/FancyCard";

// Session-level unlock flags (lost on page refresh)
const unlockedCampaigns = new Set<string>();

export default function CampaignsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [useSupabase, setUseSupabase] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [password, setPassword] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Join campaign
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinLoading, setJoinLoading] = useState(false);

  // Password modal state
  const [pwModal, setPwModal] = useState<{
    campaignId: string;
    purpose: "enter" | "delete";
  } | null>(null);
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const pwRef = useRef<HTMLInputElement>(null);

  const reload = async () => {
    if (useSupabase && user) {
      const list = await getMyCampaigns(user.id);
      for (const c of list) {
        await campaignRepo.upsert(c);
      }
      setCampaigns(list);
    } else {
      const list = await campaignRepo.getAll();
      setCampaigns(list);
    }
  };

  useEffect(() => {
    if (!hasSupabase()) {
      campaignRepo.getAll().then(setCampaigns);
      return;
    }
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user: u } }) => {
      if (u) {
        setUser({ id: u.id });
        setUseSupabase(true);
        getMyCampaigns(u.id).then(async (list) => {
          for (const c of list) await campaignRepo.upsert(c);
          setCampaigns(list);
        });
      } else {
        campaignRepo.getAll().then(setCampaigns);
      }
    });
  }, []);

  useEffect(() => {
    if (useSupabase && user) {
      reload();
    }
  }, [useSupabase, user]);

  useEffect(() => {
    if (pwModal && pwRef.current) pwRef.current.focus();
  }, [pwModal]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    if (useSupabase && user) {
      const extra: { passwordHash?: string; passwordSalt?: string } = {};
      if (password.trim()) {
        const { hash, salt } = await hashPassword(password.trim());
        extra.passwordHash = hash;
        extra.passwordSalt = salt;
      }
      const created = await createCampaign(user.id, {
        name: name.trim(),
        description: desc.trim(),
        ...extra,
      });
      if (created) {
        await campaignRepo.upsert(created);
        unlockedCampaigns.add(created.id);
        setName("");
        setDesc("");
        setPassword("");
        reload();
      }
      return;
    }

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
    unlockedCampaigns.add(created.id);
    setName("");
    setDesc("");
    setPassword("");
    reload();
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    const code = joinCode.trim();
    if (!code || !user) return;
    setJoinLoading(true);
    setJoinError("");
    const result = await joinCampaign(user.id, code);
    setJoinLoading(false);
    if (result.ok) {
      await campaignRepo.upsert(result.campaign);
      setJoinCode("");
      reload();
    } else {
      setJoinError(result.error);
    }
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
    "w-full rounded px-3 py-2 text-sm focus:outline-none dh-input";

  return (
    <div className="max-w-3xl">
      <h1 className="text-xl font-bold mb-6" style={{ color: "var(--text-primary)" }}>Kampaně</h1>

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
        <button type="submit" className="dh-btn-primary font-medium text-sm px-4 py-2 rounded-lg transition-colors">
          + Nová kampaň
        </button>
      </form>

      {useSupabase && user && (
        <form onSubmit={handleJoin} className="mb-8 p-4 rounded-xl" style={{ border: "1px dashed var(--border-default)", background: "rgba(42,35,28,0.5)" }}>
          <p className="text-sm font-medium mb-2" style={{ color: "var(--text-primary)" }}>Pripojiť sa ku kampani</p>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>Zadaj kód kampaně (UUID) a stiskni Pripojiť.</p>
          <div className="flex gap-2 flex-wrap">
            <input
              value={joinCode}
              onChange={(e) => { setJoinCode(e.target.value); setJoinError(""); }}
              placeholder="napr. a1b2c3d4-e5f6-..."
              className={inputClass + " flex-1 min-w-[200px]"}
            />
            <button type="submit" disabled={joinLoading || !joinCode.trim()} className="dh-btn-primary font-medium text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50">
              {joinLoading ? "Spracovávam…" : "Pripojiť sa"}
            </button>
          </div>
          {joinError && <p className="text-xs text-red-400 mt-2">{joinError}</p>}
        </form>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {campaigns.length === 0 && (
          <p className="text-sm col-span-full" style={{ color: "var(--text-muted)" }}>Zatím žádné kampaně.</p>
        )}
        {campaigns.map((c) =>
          editingId === c.id ? (
            <div key={c.id} className="rounded-xl p-4 space-y-2" style={{ border: "1px solid var(--border-accent)", background: "var(--bg-panel)" }}>
              <input value={editName} onChange={(e) => setEditName(e.target.value)} className={inputClass} />
              <input value={editDesc} onChange={(e) => setEditDesc(e.target.value)} placeholder="Popis" className={inputClass} />
              <div className="flex gap-2">
                <button onClick={handleSaveEdit} className="dh-btn-primary font-medium text-sm px-3 py-1.5 rounded transition-colors">
                  Uložit
                </button>
                <button onClick={() => setEditingId(null)} className="text-sm px-3 py-1.5 transition-colors" style={{ color: "var(--text-muted)" }}>
                  Zrušit
                </button>
              </div>
            </div>
          ) : (
            <FancyCard
              key={c.id}
              title={(c.passwordHash ? "🔒 " : "") + c.name}
              role={new Date(c.updatedAt || c.createdAt).toLocaleDateString("sk-SK")}
              watermark={c.name.slice(0, 2).toUpperCase()}
              theme={(() => {
                const idx = campaigns.indexOf(c);
                const themes = ["gold","amber","violet","emerald","rose","cyan"] as const;
                return themes[idx % themes.length];
              })()}
              items={[
                ...(c.description ? [{ icon: "📜", label: c.description }] : []),
                { icon: "🔑", label: c.id.slice(0, 8) },
              ]}
              onClick={() => handleCampaignClick(c)}
            >
              <div className="flex gap-2 mt-2 pt-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                <button onClick={(e) => { e.stopPropagation(); startEdit(c); }}
                  className="text-[11px] px-2 py-1 rounded transition-colors"
                  style={{ color: "rgba(255,210,100,0.6)", background: "rgba(255,210,100,0.06)" }}
                >
                  ✏️ Upravit
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleDeleteClick(c); }}
                  className="text-[11px] px-2 py-1 rounded transition-colors"
                  style={{ color: "rgba(248,113,113,0.6)", background: "rgba(248,113,113,0.06)" }}
                >
                  ✕ Smazat
                </button>
              </div>
            </FancyCard>
          )
        )}
      </div>

      {/* Password modal */}
      {pwModal && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: "rgba(0,0,0,0.7)" }} onClick={() => setPwModal(null)}>
          <div className="rounded-lg p-6 w-80 max-w-[90vw]" style={{ background: "var(--bg-card)", border: "1px solid var(--border-default)" }} onClick={(e) => e.stopPropagation()}>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              {pwModal.purpose === "enter" ? "Zadej heslo kampaně" : "Potvrď heslem pro smazání"}
            </p>
            <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
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
                      ? "text-white"
                      : "dh-btn-primary"
                  }`}
                  style={pwModal.purpose === "delete" ? { background: "#8b3a3a" } : undefined}
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
