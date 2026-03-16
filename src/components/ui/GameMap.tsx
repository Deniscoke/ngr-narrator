"use client";

// ============================================================
// GameMap — right-panel world map
// Wraps SvgWorldMapRenderer (swappable) + active marker list.
// Clicking a marker row highlights its location on the SVG map.
// ============================================================

import { useState } from "react";
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

const MARKER_TYPE_LABELS: Record<MapMarkerData["type"], string> = {
  enemy: "Nepřítel",
  city: "Město",
  poi: "Místo",
  quest: "Úkol",
  npc: "Postava",
};

export default function GameMap({ currentLocation, markers }: GameMapProps) {
  const activeMarkers = markers.filter((m) => m.active);
  const [focusedLocationId, setFocusedLocationId] = useState<string | null>(null);

  function handleMarkerClick(locationId: string) {
    // Toggle focus — second click on same marker clears it
    setFocusedLocationId((prev) => (prev === locationId ? null : locationId));
  }

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
      <div
        className="flex-1 min-h-0 rounded-lg overflow-hidden"
        style={{ border: "1px solid rgba(120,90,50,0.25)" }}
      >
        <SvgWorldMapRenderer
          currentLocation={currentLocation}
          markers={markers}
          focusedLocationId={focusedLocationId}
        />
      </div>

      {/* Active marker list — scrollable, compact */}
      {activeMarkers.length > 0 && (
        <div
          className="flex-shrink-0 overflow-y-auto max-h-32"
          style={{ scrollbarWidth: "thin", scrollbarColor: "rgba(63,63,70,0.5) transparent" }}
        >
          <p className="text-[9px] uppercase tracking-wider mb-1.5" style={{ color: "var(--text-muted)" }}>
            Body na mapě
          </p>
          <ul className="space-y-1">
            {activeMarkers.map((m) => {
              const isFocused = focusedLocationId === m.locationId;
              return (
                <li
                  key={m.id}
                  onClick={() => handleMarkerClick(m.locationId)}
                  className="flex items-start gap-1.5 text-[11px] px-2 py-1 rounded cursor-pointer transition-colors"
                  style={{
                    color: "var(--text-secondary)",
                    background: isFocused ? "rgba(96,165,250,0.08)" : "transparent",
                    border: isFocused ? "1px solid rgba(96,165,250,0.25)" : "1px solid transparent",
                  }}
                  title={`${MARKER_TYPE_LABELS[m.type]} — kliknutím zvýraz na mapě`}
                >
                  <span className="flex-shrink-0">{MARKER_ICONS_EMOJI[m.type]}</span>
                  <span className="font-medium flex-shrink-0">{m.name}</span>
                  {m.description && (
                    <span className="truncate" style={{ color: "var(--text-muted)" }}>
                      — {m.description}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* Empty state */}
      {!currentLocation && activeMarkers.length === 0 && (
        <p className="text-center text-xs italic" style={{ color: "var(--text-dim, rgba(100,80,50,0.4))" }}>
          Mapa se naplní po prvním vyprávění.
        </p>
      )}
    </div>
  );
}
