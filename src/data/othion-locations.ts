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
