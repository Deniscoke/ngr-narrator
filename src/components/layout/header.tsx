"use client";

import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth/AuthButton";

const ROUTE_TITLES: Record<string, string> = {
  "/app": "Dračí Hlídka",
  "/app/campaigns": "Kampane",
  "/app/profile": "Profil",
  "/app/sien-slavy": "Sieň slávy",
  "/app/rules": "Pravidlá",
};

export function Header() {
  const pathname = usePathname();

  const title =
    ROUTE_TITLES[pathname] ??
    (pathname.includes("/narrate")
      ? "Rozprávanie"
      : pathname.includes("/characters")
        ? "Postavy"
        : pathname.includes("/sessions")
          ? "Sedenia"
          : "RPG Narrator");

  return (
    <header className="h-14 flex items-center justify-between px-6 backdrop-blur" style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-panel)" }}>
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <AuthButton />
    </header>
  );
}
