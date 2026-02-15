// ============================================================
// RPG Narrator Engine — Core Types
// ============================================================

export interface Campaign {
  id: string;
  name: string;
  description: string;
  rulesetId: string; // e.g. "drd2", "generic", "custom"
  memorySummary?: string; // 1–3 sentence compressed memory, updated after each narration
  houseRules?: string; // user-provided campaign notes / house rules
  rulesPackText?: string; // user-editable plain-text rules context for AI
  passwordHash?: string;  // PBKDF2 hash (base64) — app-level lock, not secure auth
  passwordSalt?: string;  // salt (base64)
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  campaignId: string;
  title: string;
  summary: string;
  date: string;
  order: number;
  createdAt: string;
}

export interface Character {
  id: string;
  campaignId: string;
  name: string;
  race: string;
  class: string;
  level: number;
  hp?: number;          // hit points — undefined means "not tracked"
  maxHp?: number;
  xp?: number;
  stats: Record<string, number>;
  statuses?: string[];  // e.g. ["Invisible", "Poisoned"]
  injuries?: string[];  // e.g. ["Broken arm"]
  notes: string;
  isNPC: boolean;
  createdAt: string;
  updatedAt: string;
}

// ---- Narration Consequences ----

export interface CharacterDelta {
  characterName: string;
  characterId?: string;   // resolved after name→id mapping
  xpDelta?: number;
  hpDelta?: number;
  addStatuses?: string[];
  removeStatuses?: string[];
  addInjuries?: string[];
  removeInjuries?: string[];
  addItems?: string[];      // items gained
  removeItems?: string[];   // items lost / consumed
  addNotes?: string[];
}

export interface NarrationConsequences {
  eventSummary: string;
  deltas: CharacterDelta[];
  lootFound?: string[];       // items discovered in scene (not yet assigned)
  combatLog?: string;         // short combat description if applicable
  updatedCampaignSummary?: string; // optional campaign summary override
}

export interface MemoryEntry {
  id: string;
  campaignId: string;
  sessionId?: string;
  type: "note" | "event" | "lore" | "quest";
  title: string;
  content: string;
  tags: string[];
  createdAt: string;
}

// Narration history
export interface NarrationEntry {
  id: string;
  campaignId: string;
  createdAt: string;
  mode: "mock" | "ai";
  userInput: string;
  narrationText: string;
  suggestedActions: string[];
  consequences?: NarrationConsequences; // deltas applied to characters
}

// ---- Campaign State — long-session world tracking ----

export interface CampaignState {
  id: string; // same as campaignId — 1:1 mapping
  campaignId: string;
  location?: string; // current place / area
  scene?: string; // short description of current scene
  party?: string[]; // active party member names
  npcs?: string[]; // recently-encountered NPC names
  threads?: string[]; // active story threads / quests
  flags?: Record<string, boolean | string>; // arbitrary world flags
  tone?: string; // e.g. "dark", "comedic", "epic"
  lastBeats?: string[]; // last N narrative beat types used (max 8)
  lastPhrases?: string[]; // last N opening phrases used (max 12)
  createdAt: string;
  updatedAt?: string;
}

// Future use — rules ingestion pipeline
export interface RulesChunk {
  id: string;
  rulesetId: string;
  source: string;        // filename / section
  content: string;       // paraphrased text
  embedding?: number[];  // future vector search
  tags: string[];
  createdAt: string;
}

// Schema versioning for localStorage
export interface StorageSchema {
  version: number;
  campaigns: Campaign[];
  sessions: Session[];
  characters: Character[];
  memories: MemoryEntry[];
  narrations: NarrationEntry[];
  campaignStates: CampaignState[];
}

export const CURRENT_SCHEMA_VERSION = 4;
