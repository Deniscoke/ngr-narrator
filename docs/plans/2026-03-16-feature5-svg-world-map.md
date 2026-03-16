# Feature 5: SVG World Map Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the text-list `GameMap` with a procedural SVG world map showing location nodes, adjacency edges, current location highlighting, and marker icons — all behind a swappable renderer interface; also move the combat map from an inline left-panel block to a dedicated right-panel "⚔️ Boj" tab.

**Architecture:** `src/data/othion-locations.ts` is extended with x/y SVG coordinates and adjacency lists. A new `SvgWorldMapRenderer.tsx` renders the SVG canvas and exports the `WorldMapRendererProps` interface (enabling a future `ImageWorldMapRenderer` drop-in). `GameMap.tsx` is updated to use the renderer. The narrate page gains a third right-panel tab "combat" that hosts `CombatMap`, auto-activated when `combatInitiated` fires; `CombatMap` is removed from the left column.

**Tech Stack:** React SVG (inline, no library), TypeScript, Tailwind/CSS vars, Next.js App Router (`"use client"`)

---

## Existing Code to Read First

Before touching anything:
- `src/data/othion-locations.ts` — current AI prompt (14 world + 4 ihienburgh locations as text)
- `src/components/ui/GameMap.tsx` — current text-list map using `MapLocation` + `MapMarkerData`
- `src/components/ui/CombatMap.tsx` — grid-based combat map
- `src/lib/ai/provider.ts` — `MapLocation`, `MapMarkerData` types
- `src/app/(main)/app/campaigns/[id]/narrate/page.tsx` lines 854–920 — right panel tab UI
- `src/app/(main)/app/campaigns/[id]/narrate/page.tsx` lines 662–671 — current `CombatMap` inline block

---

## Task 5.1: Extend othion-locations.ts with coordinates + adjacency

**Files:**
- Modify: `src/data/othion-locations.ts`

**Step 1: Add `OthionLocation` interface and coordinate data**

Replace the entire file content with:

```typescript
// ============================================================
// Othion — mapa světa pro AI vypravěče (DH-LITE)
// locationId používá AI v mapLocation.
// Coordinates (x, y) are for the SVG renderer (viewBox 0 0 400 280).
// ============================================================

export interface OthionLocation {
  id: string;
  name: string;
  map: "world" | "ihienburgh";
  x: number;
  y: number;
  /** IDs of directly connected locations (for drawing edges) */
  adjacent: string[];
}

export const OTHION_LOCATIONS: OthionLocation[] = [
  // ── World map (othion) ────────────────────────────────────
  {
    id: "othion_hlavni_mesto",
    name: "Hlavní město",
    map: "world",
    x: 200, y: 140,
    adjacent: ["othion_les", "othion_vesnice", "othion_bažina", "othion_ruiny", "othion_hrad", "othion_most", "othion_taverna"],
  },
  {
    id: "othion_les",
    name: "Temný les",
    map: "world",
    x: 100, y: 100,
    adjacent: ["othion_hlavni_mesto", "othion_klášter", "othion_bažina"],
  },
  {
    id: "othion_vesnice",
    name: "Zapadlá vesnice",
    map: "world",
    x: 300, y: 95,
    adjacent: ["othion_hlavni_mesto", "othion_hory", "othion_klášter"],
  },
  {
    id: "othion_hory",
    name: "Hory severu",
    map: "world",
    x: 200, y: 35,
    adjacent: ["othion_vesnice", "othion_klášter"],
  },
  {
    id: "othion_bažina",
    name: "Bažina",
    map: "world",
    x: 80, y: 195,
    adjacent: ["othion_les", "othion_hlavni_mesto", "othion_jeskyně", "othion_doly"],
  },
  {
    id: "othion_jeskyně",
    name: "Jeskyně",
    map: "world",
    x: 150, y: 235,
    adjacent: ["othion_bažina", "othion_ruiny"],
  },
  {
    id: "othion_ruiny",
    name: "Staré ruiny",
    map: "world",
    x: 260, y: 230,
    adjacent: ["othion_hlavni_mesto", "othion_jeskyně", "othion_hrad", "othion_pobřeží"],
  },
  {
    id: "othion_hrad",
    name: "Opuštěný hrad",
    map: "world",
    x: 330, y: 175,
    adjacent: ["othion_hlavni_mesto", "othion_ruiny", "othion_most"],
  },
  {
    id: "othion_klášter",
    name: "Klášter",
    map: "world",
    x: 135, y: 50,
    adjacent: ["othion_les", "othion_vesnice", "othion_hory"],
  },
  {
    id: "othion_taverna",
    name: "Taverna",
    map: "world",
    x: 222, y: 158,
    adjacent: ["othion_hlavni_mesto"],
  },
  {
    id: "othion_cesta",
    name: "Cesta",
    map: "world",
    x: 185, y: 172,
    adjacent: ["othion_hlavni_mesto", "othion_most"],
  },
  {
    id: "othion_most",
    name: "Most přes řeku",
    map: "world",
    x: 285, y: 148,
    adjacent: ["othion_hlavni_mesto", "othion_hrad", "othion_cesta"],
  },
  {
    id: "othion_pobřeží",
    name: "Pobřeží",
    map: "world",
    x: 355, y: 245,
    adjacent: ["othion_ruiny", "othion_hrad"],
  },
  {
    id: "othion_doly",
    name: "Opuštěné doly",
    map: "world",
    x: 55, y: 155,
    adjacent: ["othion_bažina", "othion_les"],
  },
  // ── Ihienburgh region ─────────────────────────────────────
  {
    id: "ihienburgh_mesto",
    name: "Ihienburgh",
    map: "ihienburgh",
    x: 200, y: 155,
    adjacent: ["ihienburgh_okoli", "ihienburgh_les", "ihienburgh_hrad"],
  },
  {
    id: "ihienburgh_okoli",
    name: "Okolí Ihienburghu",
    map: "ihienburgh",
    x: 200, y: 75,
    adjacent: ["ihienburgh_mesto", "ihienburgh_hrad"],
  },
  {
    id: "ihienburgh_les",
    name: "Les u Ihienburghu",
    map: "ihienburgh",
    x: 95, y: 175,
    adjacent: ["ihienburgh_mesto", "ihienburgh_okoli"],
  },
  {
    id: "ihienburgh_hrad",
    name: "Hrad",
    map: "ihienburgh",
    x: 310, y: 100,
    adjacent: ["ihienburgh_mesto", "ihienburgh_okoli"],
  },
];

// Fast lookup by id
export const OTHION_LOCATION_MAP = new Map<string, OthionLocation>(
  OTHION_LOCATIONS.map((l) => [l.id, l])
);

// ── AI prompt — unchanged format (AI doesn't need coordinates) ──────────
export const OTHION_LOCATIONS_PROMPT = `
## MAPA SVĚTA OTHION — lokace (použij locationId v mapLocation)

Mapa "world" (hlavní svět):
- othion_hlavni_mesto — Hlavní město
- othion_les — Temný les
- othion_vesnice — Zapadlá vesnice
- othion_hory — Hory severu
- othion_bažina — Bažina
- othion_jeskyně — Jeskyně
- othion_ruiny — Staré ruiny
- othion_hrad — Opuštěný hrad
- othion_klášter — Klášter
- othion_taverna — Taverna
- othion_cesta — Cesta
- othion_most — Most přes řeku
- othion_pobřeží — Pobřeží
- othion_doly — Opuštěné doly

Mapa "ihienburgh" (region):
- ihienburgh_mesto — Ihienburgh
- ihienburgh_okoli — Okolí Ihienburghu
- ihienburgh_les — Les u Ihienburghu
- ihienburgh_hrad — Hrad
`.trim();
```

**Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep -v rpg-narrator
```
Expected: no errors (OTHION_LOCATIONS_PROMPT is still exported, openai-provider.ts still imports it).

**Step 3: Commit**
```bash
git add src/data/othion-locations.ts
git commit -m "feat(map): add OthionLocation type with x/y coords and adjacency to othion-locations"
```

---

## Task 5.2: Create SvgWorldMapRenderer.tsx

**Files:**
- Create: `src/components/ui/SvgWorldMapRenderer.tsx`

**Step 1: Write the component**

```tsx
"use client";

// ============================================================
// SvgWorldMapRenderer — procedural SVG world map
// Renders location nodes, adjacency edges, current location,
// and marker icons. Implements WorldMapRendererProps interface
// (swappable: ImageWorldMapRenderer can replace this later).
// ============================================================

import { OTHION_LOCATIONS, OTHION_LOCATION_MAP, type OthionLocation } from "@/data/othion-locations";
import type { MapLocation, MapMarkerData } from "@/lib/ai/provider";

// ---- Swappable renderer interface ----

export interface WorldMapRendererProps {
  currentLocation: MapLocation | null;
  markers: MapMarkerData[];
}

// ---- Constants ----

const VIEW_W = 400;
const VIEW_H = 280;
const NODE_R = 10;  // radius of location circle

const MARKER_ICONS: Record<MapMarkerData["type"], string> = {
  enemy: "⚔",
  city: "🏰",
  poi: "◆",
  quest: "!",
  npc: "☺",
};

const MARKER_COLORS: Record<MapMarkerData["type"], string> = {
  enemy: "#f87171",
  city: "#fbbf24",
  poi: "#a78bfa",
  quest: "#34d399",
  npc: "#60a5fa",
};

// ---- Helpers ----

/** Deduplicate edges so A-B and B-A are drawn only once */
function buildEdges(locations: OthionLocation[]): Array<[OthionLocation, OthionLocation]> {
  const seen = new Set<string>();
  const edges: Array<[OthionLocation, OthionLocation]> = [];
  for (const loc of locations) {
    for (const adjId of loc.adjacent) {
      const key = [loc.id, adjId].sort().join("|");
      if (!seen.has(key)) {
        seen.add(key);
        const adj = OTHION_LOCATION_MAP.get(adjId);
        if (adj) edges.push([loc, adj]);
      }
    }
  }
  return edges;
}

// ---- Component ----

export default function SvgWorldMapRenderer({ currentLocation, markers }: WorldMapRendererProps) {
  const mapType = currentLocation?.map ?? "world";
  const locations = OTHION_LOCATIONS.filter((l) => l.map === mapType);
  const edges = buildEdges(locations);
  const activeMarkers = markers.filter((m) => m.active);

  // Build a map of locationId → markers on that location
  const markersByLocation = new Map<string, MapMarkerData[]>();
  for (const m of activeMarkers) {
    const existing = markersByLocation.get(m.locationId) ?? [];
    markersByLocation.set(m.locationId, [...existing, m]);
  }

  return (
    <svg
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      className="w-full h-full"
      style={{ background: "rgba(15, 10, 5, 0.8)", borderRadius: 8 }}
      aria-label="Mapa světa"
    >
      {/* Background texture — subtle grid */}
      <defs>
        <pattern id="mapgrid" x="0" y="0" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(120,90,50,0.08)" strokeWidth="0.5" />
        </pattern>
        {/* Glow filter for current location */}
        <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={VIEW_W} height={VIEW_H} fill="url(#mapgrid)" />

      {/* Edges */}
      {edges.map(([a, b]) => (
        <line
          key={`${a.id}-${b.id}`}
          x1={a.x} y1={a.y}
          x2={b.x} y2={b.y}
          stroke="rgba(120,90,50,0.35)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      ))}

      {/* Location nodes */}
      {locations.map((loc) => {
        const isCurrent = currentLocation?.locationId === loc.id;
        const locMarkers = markersByLocation.get(loc.id) ?? [];
        const topMarker = locMarkers[0];

        return (
          <g key={loc.id}>
            {/* Current location — outer glow ring */}
            {isCurrent && (
              <circle
                cx={loc.x} cy={loc.y}
                r={NODE_R + 5}
                fill="none"
                stroke="rgba(201,162,39,0.5)"
                strokeWidth="2"
                filter="url(#glow)"
              />
            )}

            {/* Node circle */}
            <circle
              cx={loc.x} cy={loc.y}
              r={NODE_R}
              fill={isCurrent ? "rgba(201,162,39,0.25)" : "rgba(42,35,28,0.85)"}
              stroke={isCurrent ? "var(--accent-gold, #c9a227)" : "rgba(120,90,50,0.6)"}
              strokeWidth={isCurrent ? 2 : 1}
            />

            {/* Location marker icon (topmost active marker) */}
            {topMarker && (
              <text
                x={loc.x} y={loc.y + 1}
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="8"
                fill={MARKER_COLORS[topMarker.type]}
              >
                {MARKER_ICONS[topMarker.type]}
              </text>
            )}

            {/* Multiple markers — small badge */}
            {locMarkers.length > 1 && (
              <text
                x={loc.x + NODE_R - 1} y={loc.y - NODE_R + 1}
                fontSize="6"
                fill="rgba(251,191,36,0.9)"
                textAnchor="middle"
              >
                +{locMarkers.length - 1}
              </text>
            )}

            {/* Location name label */}
            <text
              x={loc.x} y={loc.y + NODE_R + 9}
              textAnchor="middle"
              fontSize="7"
              fill={isCurrent ? "rgba(201,162,39,0.9)" : "rgba(180,150,100,0.65)"}
              fontWeight={isCurrent ? "bold" : "normal"}
            >
              {loc.name}
            </text>

            {/* Tooltip */}
            <title>{loc.name}{locMarkers.length > 0 ? ` — ${locMarkers.map(m => m.name).join(", ")}` : ""}</title>
          </g>
        );
      })}

      {/* Legend — bottom right */}
      <text x={VIEW_W - 4} y={VIEW_H - 4} textAnchor="end" fontSize="6" fill="rgba(120,90,50,0.5)">
        {mapType === "ihienburgh" ? "Ihienburgh" : "Svět Othion"}
      </text>
    </svg>
  );
}
```

**Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep -v rpg-narrator
```
Expected: no errors.

**Step 3: Commit**
```bash
git add src/components/ui/SvgWorldMapRenderer.tsx
git commit -m "feat(map): add SvgWorldMapRenderer with nodes, edges, current location highlight, marker icons"
```

---

## Task 5.3: Update GameMap.tsx to use SvgWorldMapRenderer

**Files:**
- Modify: `src/components/ui/GameMap.tsx`

**Step 1: Rewrite GameMap to use SvgWorldMapRenderer**

Replace the entire file:

```tsx
"use client";

// ============================================================
// GameMap — right-panel world map
// Wraps SvgWorldMapRenderer (swappable) + active marker list
// ============================================================

import type { MapLocation, MapMarkerData } from "@/lib/ai/provider";
import SvgWorldMapRenderer from "./SvgWorldMapRenderer";

interface GameMapProps {
  currentLocation: MapLocation | null;
  markers: MapMarkerData[];
}

const MARKER_ICONS_EMOJI: Record<MapMarkerData["type"], string> = {
  enemy: "⚔️",
  city: "🏰",
  poi: "📍",
  quest: "📜",
  npc: "👤",
};

export default function GameMap({ currentLocation, markers }: GameMapProps) {
  const activeMarkers = markers.filter((m) => m.active);

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Current location banner */}
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
          Poloha:
        </span>
        <span className="text-xs font-medium truncate" style={{ color: "var(--accent-gold)" }}>
          {currentLocation?.locationName ?? "—"}
        </span>
        {currentLocation && (
          <span className="text-[9px] ml-auto" style={{ color: "var(--text-dim, rgba(100,80,50,0.5))" }}>
            {currentLocation.map === "ihienburgh" ? "region" : "svět"}
          </span>
        )}
      </div>

      {/* SVG map — fills available space */}
      <div className="flex-1 min-h-0 rounded-lg overflow-hidden"
        style={{ border: "1px solid rgba(120,90,50,0.25)" }}>
        <SvgWorldMapRenderer currentLocation={currentLocation} markers={markers} />
      </div>

      {/* Active marker list — scrollable, compact */}
      {activeMarkers.length > 0 && (
        <div className="flex-shrink-0 overflow-y-auto max-h-32"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(63,63,70,0.5) transparent" }}>
          <p className="text-[9px] uppercase tracking-wider mb-1" style={{ color: "var(--text-muted)" }}>
            Body na mapě
          </p>
          <ul className="space-y-1">
            {activeMarkers.map((m) => (
              <li key={m.id} className="flex items-start gap-1.5 text-[11px]"
                style={{ color: "var(--text-secondary)" }}>
                <span>{MARKER_ICONS_EMOJI[m.type]}</span>
                <span className="font-medium">{m.name}</span>
                {m.description && (
                  <span className="truncate" style={{ color: "var(--text-muted)" }}>
                    — {m.description}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {!currentLocation && activeMarkers.length === 0 && (
        <p className="text-center text-xs italic" style={{ color: "var(--text-dim, rgba(100,80,50,0.4))" }}>
          Mapa se naplní po prvním vyprávění.
        </p>
      )}
    </div>
  );
}
```

**Step 2: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep -v rpg-narrator
```
Expected: no errors.

**Step 3: Commit**
```bash
git add src/components/ui/GameMap.tsx
git commit -m "feat(map): update GameMap to use SvgWorldMapRenderer with SVG canvas + compact marker list"
```

---

## Task 5.4: Add "⚔️ Boj" combat tab to narrate page right panel

**Files:**
- Modify: `src/app/(main)/app/campaigns/[id]/narrate/page.tsx`

**Step 1: Extend `rightTab` type**

Find the line:
```typescript
const [rightTab, setRightTab] = useState<"characters" | "map">("characters");
```
Replace with:
```typescript
const [rightTab, setRightTab] = useState<"characters" | "map" | "combat">("characters");
```

**Step 2: Auto-switch to combat tab when narration returns combatInitiated**

In the narration response handler, find where `setCombatScene(...)` is called.
Look for the block that processes `res.combatInitiated` and `res.combatScene`, and add:
```typescript
if (res.combatInitiated && res.combatScene) {
  setCombatScene(res.combatScene);
  setRightTab("combat");   // ← add this line
}
```

**Step 3: Remove CombatMap from left column**

Find and remove this block entirely (lines 662–671):
```tsx
{/* Combat map — zobrazí se když AI spustí bojový režim */}
{combatScene && (
  <div className="mb-4">
    <CombatMap
      scene={combatScene}
      characters={characters}
      onClose={() => setCombatScene(null)}
    />
  </div>
)}
```

**Step 4: Add combat tab button to right panel tab switcher**

Find the tab switcher block (the `<div className="flex border-b ...">` around line 858).
Add a third tab button after the "🗺 Mapa" button:

```tsx
{combatScene && (
  <button
    onClick={() => setRightTab("combat")}
    className={`flex-1 py-2 text-xs font-medium tracking-wider uppercase transition-colors ${
      rightTab === "combat"
        ? "text-red-400 border-b-2 border-red-500"
        : "text-zinc-500 hover:text-zinc-300"
    }`}
  >
    ⚔️ Boj
  </button>
)}
```

**Step 5: Add combat tab content to right panel**

Find the tab content block:
```tsx
{rightTab === "characters" ? (
  ...
) : (
  <div className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
    <GameMap currentLocation={mapLocation} markers={mapMarkers} />
  </div>
)}
```

Replace the ternary with a proper three-way conditional:
```tsx
{rightTab === "characters" ? (
  <div className="flex-1 overflow-hidden">
    {/* ... existing characters panel content unchanged ... */}
  </div>
) : rightTab === "combat" && combatScene ? (
  <div className="flex-1 overflow-y-auto">
    <CombatMap
      scene={combatScene}
      characters={characters}
      onClose={() => {
        setCombatScene(null);
        setRightTab("map");
      }}
    />
  </div>
) : (
  <div className="flex-1 overflow-hidden" style={{ minHeight: 400 }}>
    <GameMap currentLocation={mapLocation} markers={mapMarkers} />
  </div>
)}
```

**Step 6: TypeScript check**
```bash
npx tsc --noEmit 2>&1 | grep -v rpg-narrator
```
Expected: no errors.

**Step 7: Commit**
```bash
git add "src/app/(main)/app/campaigns/[id]/narrate/page.tsx"
git commit -m "feat(map): add combat tab to right panel — auto-switch on combatInitiated, remove inline CombatMap from left column"
```

---

## Regression Risks

| Risk | Impact | Mitigation |
|------|--------|-----------|
| `OTHION_LOCATIONS_PROMPT` still exported | None — openai-provider.ts imports it | Kept exactly as before |
| Adjacent IDs with typos (č, š, ž) in Czech strings | Medium — edge won't draw | Verify in `buildEdges`: missing adj silently skipped (`if (adj)` guard) |
| SVG text rendering in Safari | Low — `dominantBaseline="central"` fallback | Acceptable; text may shift 1-2px |
| `rightTab="combat"` lingers after `combatScene` cleared | Low — shows blank panel | `onClose` always switches back to "map" |
| CombatMap removed from left column breaks mobile users | Medium — mobile doesn't show right panel | The `combatScene && ... CombatMap` block should remain visible on mobile; the right panel is `hidden lg:block`. **See note below.** |

**⚠️ Mobile note:** The right panel has `hidden lg:block`. On mobile, the combat tab won't be visible. After removing the left-column CombatMap, mobile users lose access to combat entirely. **Solution:** Keep a minimal mobile combat indicator in the left column — show a small "⚔️ Boj probíhá" banner with a link/button to scroll to the right panel (or keep a compressed CombatMap summary). This is tracked as a follow-up; the Task 5.4 implementation leaves the mobile story for a future task by adding the banner only, not the full map.

---

## Commit Sequence Summary

```
feat(map): add OthionLocation type with x/y coords and adjacency to othion-locations
feat(map): add SvgWorldMapRenderer with nodes, edges, current location highlight, marker icons
feat(map): update GameMap to use SvgWorldMapRenderer with SVG canvas + compact marker list
feat(map): add combat tab to right panel — auto-switch on combatInitiated, remove inline CombatMap from left column
```
