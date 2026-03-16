# Feature Bundle Design — Dračí Hlídka
**Date:** 2026-03-16
**Status:** Approved (with security adjustments)
**Features:** Join Flow · Czech Unification · Dice Restriction · Campaign History · World Map

---

## 1. Campaign Join Flow (secure)

### Problem
`joinCampaign()` accepts direct UUID. New users cannot SELECT campaigns before membership exists (RLS paradox). Password hash was proposed as a client-sent credential — rejected as it would act as a reusable token.

### Design
**New API route:** `POST /api/campaigns/join`
- Body: `{ joinCode: string, password?: string }` (plaintext over HTTPS)
- Server fetches campaign by `join_code` using service-role/server Supabase client (bypasses RLS)
- Server calls `verifyPassword(plaintext, storedHash, storedSalt)` from `password.ts` — WebCrypto PBKDF2, works in Node.js 18+ and Edge runtime
- On success: inserts `campaign_members` row via SQL function (security definer)
- Client never sends hash; hash never leaves the server

**DB changes:**
```sql
ALTER TABLE campaigns ADD COLUMN join_code text UNIQUE NOT NULL
  DEFAULT upper(substring(replace(gen_random_uuid()::text,'-',''),1,6));
ALTER TABLE campaigns ADD COLUMN is_public boolean NOT NULL DEFAULT false;

-- Security definer: inserts member without password check (done in API route)
CREATE OR REPLACE FUNCTION public.join_campaign_by_code(p_join_code text)
  RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER ...
```

**UI:** Join modal with two-step flow:
1. Enter `joinCode` (6-char uppercase)
2. If campaign has password: enter plaintext password (shown conditionally)
3. Owner sees join_code on campaign card with copy button

---

## 2. Czech Language Unification

### Problem
UI has 4 Slovak strings; AI system prompt lacks explicit language instruction.

### Design
**Approach:** In-place string fixes + centralized `src/lib/i18n/cs.ts` constant object for future-proofing.

**Files to fix:**
- `DiceRoller.tsx` — "Posledný hod:" → "Poslední hod:"
- `narrate/page.tsx` — 4 Slovak error/label strings in `classifyLoadError()` + "Bojové pravidlá"
- `openai-provider.ts` — add language instruction to `buildSystemPrompt()`

**AI layer:** Explicit instruction added to every system prompt:
```
"Komunikuj VŽDY v češtině. Nikdy nepřecházej do slovenštiny ani angličtiny."
```

---

## 3. Dice Roll Restriction

### Problem
UI has no roll limits. Server has no validation. Bonus roll can be claimed without a real critical.

### Design

**UI state machine (`DiceRoller.tsx`):**
```
idle → [roll] → rolled_normal → disabled (no more rolls)
idle → [roll] → rolled_critical → [bonus roll] → done
done/disabled → [Reset] → idle
```
Critical: d6 = 6, d20 = 20.

**Extended callback:**
```typescript
onRollResult(charName, diceType, result, meta: {
  isCritical: boolean;
  isBonusRoll: boolean;
  phase: "first" | "bonus";
})
```
Backward-compatible: `meta` is 4th optional parameter.

**Server validation (`/api/narrate/route.ts`):**
- New optional body field: `diceRolls?: DiceRollRecord[]`
- Validation rule: if any roll has `isBonusRoll: true`, there MUST exist a prior roll with `isCritical: true && !isBonusRoll`
- If violated: `400 { error: "Neplatná sekvence hodů kostkou." }`
- Valid roll data included in narrator context prompt

**Narrator context (narrate/page.tsx):**
```
"🎲 Aragorn hodil k20 = 20 — KRITICKÝ ZÁSAH! Bonusový hod: k20 = 14."
```

---

## 4. Full Campaign History as Narrator Context

### Problem
Only last 5 narrations sent. `memory_entries` table exists but is never populated. Narrator loses long-term story coherence.

### Design — 3-tier context

**Tier 1 — memory_summary** (existing, improved)
- AI generates richer summary: location + active quests + key NPCs + last 3 events
- Updated after every narration (already implemented)

**Tier 2 — Recent raw narrations** (expanded)
- 5 → 10 recent entries
- Keyword search: both `user_input` AND `narration_text` columns
- Relevant entries limit: 5 → 15

**Tier 3 — Structured story beats** (new)
- After each narration, AI returns `storyBeat` in response JSON:
  ```typescript
  interface StoryBeat {
    summary: string;          // 1–2 sentences
    location?: string;
    importantNPCs?: string[];
    questUpdates?: string[];
    combatOutcome?: string;
  }
  ```
- Server inserts `memory_entries` row: `type='event'`, `content=JSON.stringify(storyBeat)`
- Narrator gets last 10 events as structured log (not just text excerpts)

**NarrationRequest extension:**
```typescript
eventLog?: Array<{ title: string; content: string; createdAt: string }>;
```

**Why not pgvector:** Keyword + memory_entries log handles DH campaign scale (hundreds of narrations). Architecture leaves `relevantEntries` slot open for vector upgrade later.

---

## 5. World Map (SVG, swappable renderer)

### Design

**Static graph data (`src/data/world-map-graph.ts`):**
```typescript
interface WorldMapNode { id; label; x; y; region; icon }
interface WorldMapEdge { from; to; travelType }
interface WorldMapGraph { nodes; edges; viewBox }
// Data is static (world doesn't change)
// Campaign state (where party IS) stays in MapLocation + MapMarkerData
```

**Renderer interface (swappable):**
```typescript
interface WorldMapRendererProps {
  nodes: WorldMapNode[];
  edges: WorldMapEdge[];
  currentLocationId: string | null;
  markers: MapMarkerData[];
  onNodeClick?: (nodeId: string) => void;
}
// SvgWorldMapRenderer — now (SVG nodes + edges)
// ImageWorldMapRenderer — later (PNG + absolute markers, same props)
```

**Tab switching in narrate/page.tsx:**
```
type RightTab = "characters" | "world" | "location" | "combat"
```
- `world` → SvgWorldMapRenderer
- `location` → GameMap (text markers, improved)
- `combat` → CombatMap (existing)

---

## Implementation Phases

### Phase 1 — Low-risk, isolated (this session)
- **F2:** Czech string fixes + AI language instruction
- **F3:** DiceRoller state machine + server validation

### Phase 2 — Data layer
- **F1:** DB migration + API route `/api/campaigns/join` + UI modal
- **F4:** API route expansion + storyBeat AI integration + memory_entries population

### Phase 3 — New UI feature
- **F5:** world-map-graph.ts + SvgWorldMapRenderer + WorldMapTabs

---

## Commit Plan

```
feat(i18n): unify UI strings to Czech, add explicit language instruction to narrator
feat(dice): add roll state machine with critical detection and Reset button
feat(dice): add server-side dice roll sequence validation in /api/narrate
feat(join): add join_code + is_public to campaigns table (migration)
feat(join): add /api/campaigns/join route with server-side password verification
feat(join): update campaigns UI with join modal and join_code display
feat(history): expand narrator context to 10 recent + 15 relevant + event log
feat(history): generate and persist structured storyBeat per narration
feat(map): add world map graph data and SVG renderer components
feat(map): integrate world map tabs into narrate page
```

---

## Regression Risks

| Risk | Mitigation |
|------|-----------|
| `joinCampaign()` signature change | Old call `joinCampaign(userId, code)` → new is via API route; update campaigns/page.tsx caller |
| `onRollResult` new 4th param | Default `meta` value; narrate/page.tsx updated in same commit |
| `rightTab` value `"map"` renamed to `"location"` | Update all `setRightTab("map")` calls in narrate/page.tsx |
| Memory entries INSERT adds latency | Fire-and-forget (no await blocking narration response) |
| Token count increase (10+15 entries) | Truncate narration_text to 300 chars in relevant entries |
