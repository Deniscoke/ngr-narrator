"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: "⚔️" },
  { href: "/campaigns", label: "Kampane", icon: "📜" },
  { href: "/rules", label: "Pravidlá", icon: "📖" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 min-h-screen bg-zinc-900 border-r border-zinc-800 p-4 flex flex-col gap-1">
      <div className="mb-6 px-2">
        <h1 className="text-lg font-bold text-amber-400 tracking-wide">
          RPG Narrator
        </h1>
        <p className="text-xs text-zinc-500">Engine v0.1</p>
      </div>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? "bg-zinc-800 text-amber-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-zinc-800 px-2">
        <p className="text-xs text-zinc-600">Local Mode</p>
      </div>
    </aside>
  );
}
