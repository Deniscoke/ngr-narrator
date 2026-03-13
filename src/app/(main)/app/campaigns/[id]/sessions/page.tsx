"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { sessionRepo } from "@/lib/storage";
import { Session } from "@/types";

export default function SessionsPage() {
  const { id: campaignId } = useParams<{ id: string }>();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (campaignId) {
      sessionRepo
        .getAll({ campaignId } as Partial<Session>)
        .then((s) => setSessions(s.sort((a, b) => a.order - b.order)));
    }
  }, [campaignId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !campaignId) return;
    await sessionRepo.create({
      campaignId,
      title: title.trim(),
      summary: "",
      date: new Date().toISOString().slice(0, 10),
      order: sessions.length + 1,
    });
    setTitle("");
    const updated = await sessionRepo.getAll({ campaignId } as Partial<Session>);
    setSessions(updated.sort((a, b) => a.order - b.order));
  }

  return (
    <div className="max-w-3xl">
      <Link
        href={`/campaigns/${campaignId}`}
        className="text-sm text-zinc-500 hover:text-zinc-300 mb-4 inline-block"
      >
        ← Späť
      </Link>

      <h1 className="text-xl font-bold text-zinc-100 mb-6">Sedenia</h1>

      <form onSubmit={handleCreate} className="mb-6 flex gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Názov sedenia"
          className="flex-1 bg-zinc-900 border border-zinc-700 rounded px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500"
        />
        <button
          type="submit"
          className="bg-amber-600 hover:bg-amber-500 text-black font-medium text-sm px-4 py-2 rounded transition-colors"
        >
          + Pridať
        </button>
      </form>

      <div className="space-y-2">
        {sessions.length === 0 && (
          <p className="text-zinc-500 text-sm">Žiadne sedenia.</p>
        )}
        {sessions.map((s) => (
          <div
            key={s.id}
            className="border border-zinc-800 rounded-lg p-3 flex items-center justify-between"
          >
            <div>
              <p className="text-zinc-200 text-sm font-medium">
                #{s.order} — {s.title}
              </p>
              <p className="text-xs text-zinc-500">{s.date}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
