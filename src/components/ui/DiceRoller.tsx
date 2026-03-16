"use client";

import { useState } from "react";

interface DiceRollerProps {
  characters: { id: string; name: string }[];
  onRollResult: (charName: string, diceType: "d6" | "d20", result: number) => void;
}

function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

export default function DiceRoller({ characters, onRollResult }: DiceRollerProps) {
  const [selectedChar, setSelectedChar] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<{ type: string; result: number } | null>(null);

  const char = characters.find((c) => c.id === selectedChar) ?? characters[0];
  const charName = char?.name ?? "Postava";

  function handleRoll(diceType: "d6" | "d20") {
    const sides = diceType === "d6" ? 6 : 20;
    const result = roll(sides);
    setLastRoll({ type: diceType, result });
    onRollResult(charName, diceType, result);
  }

  if (characters.length === 0) return null;

  return (
    <div className="rounded-lg p-3 dh-card">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>Postava:</span>
          <select
            value={selectedChar ?? characters[0]?.id}
            onChange={(e) => setSelectedChar(e.target.value)}
            className="rounded px-2 py-1 text-sm dh-input"
          >
            {characters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleRoll("d6")}
            className="px-3 py-1.5 rounded-lg dh-btn-primary text-sm font-medium transition-colors"
          >
            k6
          </button>
          <button
            type="button"
            onClick={() => handleRoll("d20")}
            className="px-3 py-1.5 rounded-lg dh-btn-primary text-sm font-medium transition-colors"
          >
            k20
          </button>
        </div>

        {lastRoll && (
          <span className="text-sm" style={{ color: "var(--accent-gold)" }}>
            Poslední hod: {lastRoll.type.toUpperCase()} = {lastRoll.result}
          </span>
        )}
      </div>
    </div>
  );
}
