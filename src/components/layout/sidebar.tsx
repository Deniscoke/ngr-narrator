"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AuthButton } from "@/components/auth/AuthButton";

const NAV_ITEMS = [
  { href: "/app",           label: "Domov",      icon: "🏠", exact: true  },
  { href: "/app/campaigns",  label: "Kampane",   icon: "📋", exact: false },
  { href: "/app/characters", label: "Postavy",  icon: "👥", exact: false },
  { href: "/app/profile",    label: "Profil",   icon: "👤", exact: false },
  { href: "/app/sien-slavy", label: "Sieň slávy", icon: "⭐", exact: false },
  { href: "/app/rules",      label: "Pravidlá", icon: "📄", exact: false },
];

export function Sidebar() {
  const pathname = usePathname();

  function isActive(href: string, exact: boolean) {
    if (exact) return pathname === href;
    return pathname.startsWith(href);
  }

  return (
    <aside className="w-52 min-h-screen p-4 flex flex-col" style={{ background: "var(--bg-deep)", borderRight: "1px solid var(--border-subtle)" }}>
      {/* Logo */}
      <div className="mb-6 flex items-center gap-2.5">
        <div className="w-8 h-8 rounded overflow-hidden flex-shrink-0" style={{ border: "1px solid var(--border-default)" }}>
          <img
            src="/ilustrations/Logo_Wall_1024x600.jpg"
            alt="DH"
            className="w-full h-full object-cover"
          />
        </div>
        <div>
          <p className="text-sm font-bold leading-tight" style={{ color: "var(--accent-gold)" }}>Dračí Hlídka</p>
          <p className="text-[10px] leading-tight" style={{ color: "var(--text-dim)" }}>RPG Engine v0.1</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href, item.exact);
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "text-[var(--accent-gold)]"
                  : "hover:text-[var(--text-primary)]"
              }`}
              style={active ? { background: "rgba(201,162,39,0.08)", borderLeft: "2px solid var(--accent-gold)" } : { color: "var(--text-muted)" }}
            >
              <span className="text-base">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Odhlásenie */}
      <div className="mt-auto pt-4" style={{ borderTop: "1px solid var(--border-subtle)" }}>
        <AuthButton />
      </div>
    </aside>
  );
}
