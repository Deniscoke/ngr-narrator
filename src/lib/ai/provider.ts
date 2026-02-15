// ============================================================
// AI Narration Provider — contract for narration generation
// ============================================================

import type { CampaignState, NarrationConsequences } from "@/types";

export interface CompactNarrationEntry {
  userInput: string;
  narrationText: string;
  createdAt: string;
}

/** Compact character snapshot sent from client to API */
export interface CharacterSnapshot {
  id: string;
  name: string;
  race: string;
  class: string;
  level: number;
  hp?: number;
  maxHp?: number;
  xp?: number;
  statuses?: string[];
  injuries?: string[];
  notes: string;
  isNPC: boolean;
}

export interface NarrationRequest {
  campaignId: string;
  campaignTitle: string;
  campaignDescription: string;
  memorySummary: string;
  houseRules: string;
  rulesPackText: string;  // user-editable plain-text rules context for AI
  recentEntries: CompactNarrationEntry[];
  relevantEntries: CompactNarrationEntry[]; // retrieved via similarity
  campaignState: CampaignState | null;
  characters: CharacterSnapshot[];          // campaign characters snapshot
  userInput: string;
}

export interface NarrationResponse {
  narrationText: string;
  suggestedActions: string[];  // exactly 3
  updatedMemorySummary: string; // 1–3 sentences
  updatedCampaignState: Partial<CampaignState> | null;
  consequences?: NarrationConsequences; // character deltas
}

export interface NarrationProvider {
  generate(request: NarrationRequest): Promise<NarrationResponse>;
}
