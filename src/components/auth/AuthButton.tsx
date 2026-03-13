"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

function SignOutButton() {
  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.reload();
  }
  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="text-[10px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      Odhlásiť
    </button>
  );
}

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [supabaseOk, setSupabaseOk] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !key) {
      setLoading(false);
      return;
    }
    setSupabaseOk(true);

    let supabase;
    try {
      supabase = createClient();
    } catch {
      setLoading(false);
      return;
    }
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      if (user?.id) {
        localStorage.setItem("dh_user_id", user.id);
        fetch("/api/profile", { method: "POST" }).catch(() => {}); // upsert profile for Hall of Fame
      } else {
        localStorage.removeItem("dh_user_id");
      }
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user?.id) {
        localStorage.setItem("dh_user_id", session.user.id);
        fetch("/api/profile", { method: "POST" }).catch(() => {});
      } else {
        localStorage.removeItem("dh_user_id");
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <span className="text-xs text-zinc-500">…</span>;
  }

  if (!supabaseOk) {
    return null;
  }

  if (user) {
    const email = user.email ?? user.user_metadata?.email ?? "Používateľ";
    const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? email.split("@")[0];
    return (
      <div className="flex items-center gap-2">
        <Link href="/app/profile" className="text-xs truncate max-w-[120px] transition-colors hover:text-[var(--accent-gold)]" title={email} style={{ color: "var(--text-muted)" }}>
          {name}
        </Link>
        <SignOutButton />
      </div>
    );
  }

  return (
    <Link
      href="/"
      className="text-xs px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-black font-medium transition-colors"
    >
      Prihlásiť sa
    </Link>
  );
}
