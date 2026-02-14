# RPG Narrator Engine

Modulárny webový engine pre RPG rozprávača — správa kampaní, postáv, sedení a pravidiel.

## Spustenie

```powershell
cd rpg-narrator
npm install
npm run dev
```

Otvor [http://localhost:3000](http://localhost:3000).

## Architektúra

- **Engine** — `src/lib/narrator/` — generovanie narrácie (placeholder)
- **Storage** — `src/lib/storage/` — repository pattern (localStorage / Supabase)
- **Rules** — `src/lib/rules/` — ingestion + retrieval pipeline (skeleton)
- **UI** — `src/app/` + `src/components/` — Next.js App Router + Tailwind

## Supabase (voliteľné)

Nakopíruj `.env.local.example` → `.env.local` a doplň premenné. SQL schéma: `src/lib/storage/supabase-schema.sql`.

## Právna poznámka

Toto nie je oficiálny produkt žiadneho RPG vydavateľa. Pravidlá sú spracované ako parafrázované zhrnutia. Engine je navrhnutý ako generický s výmennými modulmi pravidiel.
