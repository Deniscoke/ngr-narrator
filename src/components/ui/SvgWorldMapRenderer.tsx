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
const NODE_R = 10; // radius of location circle

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
