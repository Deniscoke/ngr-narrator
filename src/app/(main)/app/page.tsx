"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { campaignRepo } from "@/lib/storage";
import { Campaign } from "@/types";
import { FancyCard, FancyCardTheme } from "@/components/ui/FancyCard";

const WALLPAPERS = [
  "/ilustrations/HLIDKA_WP2_1920x1200.jpg",
  "/ilustrations/HLIDKA_WP4_1920x1200.jpg",
  "/ilustrations/HLIDKA_WP5_1920x1200.jpg",
  "/ilustrations/HLIDKA_TORCH_1920x1200.jpg",
];

const NAV_CARDS: { href: string; icon: string; title: string; subtitle?: string; role: string; watermark: string; theme: FancyCardTheme }[] = [
  {
    href: "/app/campaigns",
    icon: "/ilustrations/home-kampane.png",
    title: "Kampane",
    role: "Správa príbehov",
    watermark: "KM",
    theme: "gold",
  },
  {
    href: "/app/rules",
    icon: "/ilustrations/home-pravidla.png",
    title: "Pravidlá",
    role: "Knižnica pravidiel",
    watermark: "PR",
    theme: "gold",
  },
  {
    href: "/app/characters",
    icon: "/ilustrations/home-postavy.png",
    title: "Postavy",
    role: "Galéria & tvorba",
    watermark: "PS",
    theme: "gold",
  },
  {
    href: "/app/sien-slavy",
    icon: "/ilustrations/home-sien-slavy.png",
    title: "Sieň slávy",
    role: "Všetci hráči",
    watermark: "HOF",
    theme: "gold",
  },
];

export default function DashboardPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [bgIndex, setBgIndex] = useState(0);
  const [bgLoaded, setBgLoaded] = useState(false);

  useEffect(() => {
    campaignRepo.getAll().then(setCampaigns);

    // Preload first BG
    const img = new Image();
    img.src = WALLPAPERS[0];
    img.onload = () => setBgLoaded(true);

    // Rotate wallpaper every 8s
    const interval = setInterval(() => {
      setBgIndex((i) => (i + 1) % WALLPAPERS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen -m-6 overflow-hidden">
      {/* Background wallpaper */}
      {bgLoaded && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat transition-all duration-[2000ms]"
          style={{ backgroundImage: `url(${WALLPAPERS[bgIndex]})` }}
        />
      )}
      {/* Dark overlay — warm wood tone */}
      <div className="absolute inset-0" style={{ background: "linear-gradient(135deg, rgba(20,18,16,0.92) 0%, rgba(28,24,20,0.85) 50%, rgba(42,35,28,0.75) 100%)" }} />

      {/* Content */}
      <div className="relative z-10 flex flex-col min-h-screen p-8 lg:p-12">

        {/* Hero section */}
        <div className="mb-10 lg:mb-14">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 rounded-lg overflow-hidden" style={{ border: "2px solid var(--border-default)", boxShadow: "0 4px 12px rgba(0,0,0,0.4)" }}>
              <img
                src="/ilustrations/Logo_Wall_1024x600.jpg"
                alt="Dračí Hlídka"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-3xl lg:text-4xl font-bold tracking-wide" style={{ color: "var(--text-primary)" }}>
                Dračí Hlídka
              </h1>
              <p className="text-sm tracking-widest uppercase" style={{ color: "var(--accent-gold)" }}>
                RPG Narrator Engine
              </p>
            </div>
          </div>
          <p className="text-base max-w-xl leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            Správa kampaní, postáv a sessionů pre Dračí Hlídku. AI narrátor,
            pravidlá a sledovanie príbehu – všetko na jednom mieste.
          </p>
        </div>

        {/* Nav cards grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-10">
          {NAV_CARDS.map((card) => (
            <FancyCard
              key={card.title}
              href={card.href}
              icon={card.icon}
              title={card.title}
              subtitle={card.subtitle}
              role={card.role}
              watermark={card.watermark}
              theme={card.theme}
              className="h-full"
            />
          ))}
        </div>

        {/* Active campaigns */}
        <div className="mb-10">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold uppercase tracking-widest" style={{ color: "var(--text-muted)" }}>
              Aktívne kampane
            </h2>
            <Link href="/app/campaigns" className="text-xs transition-colors" style={{ color: "var(--accent-gold)" }}>
              Všetky →
            </Link>
          </div>

          {campaigns.length === 0 ? (
            <div className="rounded-xl p-6 text-center backdrop-blur-sm" style={{ border: "1px dashed var(--border-default)", background: "rgba(42,35,28,0.5)" }}>
              <p className="text-sm mb-2" style={{ color: "var(--text-muted)" }}>Žiadne aktívne kampane</p>
              <Link
                href="/app/campaigns"
                className="text-sm underline underline-offset-2"
                style={{ color: "var(--accent-gold)" }}
              >
                Vytvoriť prvú kampaň
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {campaigns.slice(0, 3).map((campaign) => (
                <FancyCard
                  key={campaign.id}
                  href={`/app/campaigns/${campaign.id}`}
                  title={campaign.name}
                  role={new Date(campaign.updatedAt || campaign.createdAt).toLocaleDateString("sk-SK")}
                  watermark={campaign.name.slice(0, 2).toUpperCase()}
                  theme="gold"
                  items={campaign.description ? [{ icon: "📜", label: campaign.description }] : []}
                />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
