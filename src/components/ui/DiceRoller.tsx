"use client";

import { useState } from "react";

// ── Types ──────────────────────────────────────────────────

export type RollPhase =
  | "idle"            // no roll yet this turn
  | "rolled_normal"   // first roll done, not critical — no further rolls allowed
  | "rolled_critical" // first roll was critical — bonus roll available
  | "done";           // bonus roll used — sequence complete

export interface DiceRollMeta {
  isCritical: boolean;
  isBonusRoll: boolean;
  phase: "first" | "bonus";
}

export interface DiceRollRecord {
  diceType: "d6" | "d20";
  result: number;
  isCritical: boolean;
  isBonusRoll: boolean;
}

interface DiceRollerProps {
  characters: { id: string; name: string }[];
  /** Called for every individual roll. meta.phase distinguishes first vs. bonus. */
  onRollResult: (
    charName: string,
    diceType: "d6" | "d20",
    result: number,
    meta: DiceRollMeta
  ) => void;
}

// ── Helpers ────────────────────────────────────────────────

function roll(sides: number): number {
  return Math.floor(Math.random() * sides) + 1;
}

function isCriticalResult(diceType: "d6" | "d20", result: number): boolean {
  return (diceType === "d6" && result === 6) || (diceType === "d20" && result === 20);
}

// ── Component ──────────────────────────────────────────────

export default function DiceRoller({ characters, onRollResult }: DiceRollerProps) {
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [phase, setPhase] = useState<RollPhase>("idle");
  const [rolls, setRolls] = useState<DiceRollRecord[]>([]);

  const char = characters.find((c) => c.id === selectedCharId) ?? characters[0];
  const charName = char?.name ?? "Postava";

  // Rolling is enabled only when idle or in critical state (for bonus)
  const canRoll = phase === "idle";
  const canBonus = phase === "rolled_critical";
  const isFinished = phase === "rolled_normal" || phase === "done";

  function handleFirstRoll(diceType: "d6" | "d20") {
    if (!canRoll) return;
    const result = roll(diceType === "d6" ? 6 : 20);
    const critical = isCriticalResult(diceType, result);
    const record: DiceRollRecord = { diceType, result, isCritical: critical, isBonusRoll: false };

    setRolls([record]);
    setPhase(critical ? "rolled_critical" : "rolled_normal");
    onRollResult(charName, diceType, result, {
      isCritical: critical,
      isBonusRoll: false,
      phase: "first",
    });
  }

  function handleBonusRoll() {
    if (!canBonus) return;
    // Bonus roll uses the same dice type as the critical first roll
    const firstRoll = rolls[0];
    if (!firstRoll) return;
    const result = roll(firstRoll.diceType === "d6" ? 6 : 20);
    const record: DiceRollRecord = {
      diceType: firstRoll.diceType,
      result,
      isCritical: false,
      isBonusRoll: true,
    };

    setRolls((prev) => [...prev, record]);
    setPhase("done");
    onRollResult(charName, firstRoll.diceType, result, {
      isCritical: false,
      isBonusRoll: true,
      phase: "bonus",
    });
  }

  function handleReset() {
    setPhase("idle");
    setRolls([]);
  }

  if (characters.length === 0) return null;

  return (
    <div className="rounded-lg p-3 dh-card space-y-2">
      {/* Row 1: character selector + dice buttons */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs uppercase tracking-wider" style={{ color: "var(--text-muted)" }}>
            Postava:
          </span>
          <select
            value={selectedCharId ?? characters[0]?.id}
            onChange={(e) => setSelectedCharId(e.target.value)}
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
            onClick={() => handleFirstRoll("d6")}
            disabled={!canRoll}
            className="px-3 py-1.5 rounded-lg dh-btn-primary text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            k6
          </button>
          <button
            type="button"
            onClick={() => handleFirstRoll("d20")}
            disabled={!canRoll}
            className="px-3 py-1.5 rounded-lg dh-btn-primary text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            k20
          </button>
        </div>

        {/* Reset — visible once any roll has been made */}
        {phase !== "idle" && (
          <button
            type="button"
            onClick={handleReset}
            className="px-2.5 py-1 rounded text-xs transition-colors dh-input"
          >
            Nový hod
          </button>
        )}
      </div>

      {/* Row 2: roll history */}
      {rolls.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {rolls.map((r, i) => (
            <span
              key={i}
              style={{
                color: r.isCritical
                  ? "var(--accent-gold)"
                  : r.isBonusRoll
                  ? "var(--accent-gold)"
                  : "var(--text-secondary)",
              }}
            >
              {r.isBonusRoll ? "Bonusový hod" : "Poslední hod"}: {r.diceType.toUpperCase()} ={" "}
              <strong>{r.result}</strong>
              {r.isCritical && " 🎯 KRITICKÝ!"}
            </span>
          ))}
        </div>
      )}

      {/* Row 3: bonus roll prompt */}
      {phase === "rolled_critical" && (
        <div className="flex items-center gap-3 pt-1 border-t border-amber-700/30">
          <span className="text-xs text-amber-400">
            🎲 Kritický hod — máš nárok na bonusový hod!
          </span>
          <button
            type="button"
            onClick={handleBonusRoll}
            className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
            style={{
              background: "rgba(201,162,39,0.2)",
              border: "1px solid rgba(201,162,39,0.5)",
              color: "var(--accent-gold)",
            }}
          >
            Bonusový hod
          </button>
        </div>
      )}

      {/* Row 4: finished indicator (isFinished = rolled_normal | done, never rolled_critical) */}
      {isFinished && (
        <p className="text-[11px]" style={{ color: "var(--text-muted)" }}>
          {phase === "done"
            ? "Sekvence hodů dokončena."
            : "Hod proveden — žádný bonusový hod (není kritický)."}
        </p>
      )}
    </div>
  );
}
