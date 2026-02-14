"use client";

import { usePathname } from "next/navigation";

const ROUTE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/campaigns": "Kampane",
  "/rules": "Pravidlá",
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
    <header className="h-14 border-b border-zinc-800 bg-zinc-900/80 backdrop-blur flex items-center px-6">
      <h2 className="text-sm font-semibold text-zinc-200">{title}</h2>
    </header>
  );
}
