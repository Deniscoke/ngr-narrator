"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

function AuthErrorContent() {
  const searchParams = useSearchParams();
  const message = searchParams.get("message") ?? "auth_failed";

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6">
      <div
        className="w-full max-w-sm rounded-xl p-8 border"
        style={{
          background: "rgba(42,35,28,0.8)",
          borderColor: "rgba(185,28,28,0.5)",
        }}
      >
        <h1 className="text-xl font-bold text-red-400 text-center mb-2">
          Chyba prihlásenia
        </h1>
        <p className="text-sm text-center mb-6" style={{ color: "var(--text-secondary)" }}>
          {message === "auth_failed"
            ? "Prihlásenie zlyhalo. Skús to znova."
            : message === "not_configured"
              ? "Supabase nie je nakonfigurovaný. Pozri GOOGLE-LOGIN-SETUP.md."
              : "Nastala neočakávaná chyba."}
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/"
            className="block text-center py-3 px-4 rounded-lg font-medium"
            style={{
              background: "linear-gradient(180deg, var(--accent-gold) 0%, var(--accent-gold-dim) 100%)",
              color: "#1a1510",
            }}
          >
            Skúsiť znova
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AuthErrorPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center" style={{ color: "var(--text-muted)" }}>Načítavam…</div>}>
      <AuthErrorContent />
    </Suspense>
  );
}
