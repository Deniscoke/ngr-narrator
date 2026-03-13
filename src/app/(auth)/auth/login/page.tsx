"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      const supabase = createClient();
      const { data, error: err } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      if (data.url) {
        window.location.href = data.url;
        return;
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Neznáma chyba");
    }
    setLoading(false);
  }

  return (
    <div className="relative min-h-screen flex flex-col items-center justify-center p-6 overflow-hidden">
      {/* Background — fantasy wallpaper */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat opacity-40"
        style={{ backgroundImage: "url(/ilustrations/HLIDKA_WP4_1920x1200.jpg)" }}
      />
      <div
        className="absolute inset-0"
        style={{
          background: "linear-gradient(135deg, rgba(20,18,16,0.95) 0%, rgba(28,24,20,0.9) 50%, rgba(42,35,28,0.85) 100%)",
        }}
      />

      {/* Content */}
      <div className="relative z-10 w-full max-w-md">
        <div
          className="rounded-2xl p-8 lg:p-10 backdrop-blur-sm border"
          style={{
            background: "rgba(42,35,28,0.8)",
            borderColor: "var(--border-default)",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}
        >
          <div className="flex flex-col items-center text-center mb-8">
            <div
              className="w-24 h-24 rounded-xl overflow-hidden mb-4"
              style={{ border: "2px solid var(--border-accent)", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}
            >
              <img
                src="/ilustrations/Logo_Wall_1024x600.jpg"
                alt="Dračí Hlídka"
                className="w-full h-full object-cover"
              />
            </div>
            <h1 className="text-2xl font-bold tracking-wide mb-2" style={{ color: "var(--text-primary)" }}>
              Dračí Hlídka
            </h1>
            <p className="text-sm tracking-widest uppercase mb-1" style={{ color: "var(--accent-gold)" }}>
              RPG Narrator Engine
            </p>
            <p className="text-sm mt-4" style={{ color: "var(--text-secondary)" }}>
              Prihlás sa cez Google a vstúp do sveta kampaní, postáv a príbehov.
            </p>
          </div>

          <button
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-3 py-4 px-5 rounded-xl font-medium transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: "linear-gradient(180deg, var(--accent-gold) 0%, var(--accent-gold-dim) 100%)",
              color: "#1a1510",
              border: "1px solid rgba(201, 162, 39, 0.5)",
              boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
            }}
          >
            <svg className="w-6 h-6 flex-shrink-0" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            {loading ? "Presmerovanie na Google…" : "Prihlásiť sa cez Google"}
          </button>

          {error && (
            <p className="mt-4 text-sm text-red-400 text-center">{error}</p>
          )}

          <p className="mt-6 text-center text-xs" style={{ color: "var(--text-muted)" }}>
            Po prihlásení sa dostaneš na domovskú obrazovku Dračej Hlídky.
          </p>
        </div>
      </div>

      {/* IndiWeb branding — bokom v rohu */}
      <div
        className="absolute bottom-4 right-4 z-10 text-xs font-medium tracking-widest uppercase opacity-60 hover:opacity-80 transition-opacity"
        style={{ color: "var(--text-muted)" }}
      >
        IndiWeb
      </div>
    </div>
  );
}
