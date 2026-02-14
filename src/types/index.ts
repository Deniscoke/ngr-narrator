// ============================================================
// RPG Narrator Engine — Core Types
// ============================================================

export interface Campaign {
  id: string;
  name: string;
  description: string;
  rulesetId: string; // e.g. "drd2", "generic", "custom"
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
  stats: Record<string, number>;
  notes: string;
  isNPC: boolean;
  createdAt: string;
  updatedAt: string;
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
}

export const CURRENT_SCHEMA_VERSION = 2;
