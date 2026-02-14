// ============================================================
// Rules Retrieval Interface — SKELETON ONLY
// ============================================================
// Used by the narrator engine to look up relevant rules
// during narration generation.
// ============================================================

import { RulesChunk } from "@/types";

export interface RetrievalQuery {
  rulesetId: string;
  query: string;
  tags?: string[];
  limit?: number;
}

export interface RulesRetriever {
  /**
   * Search rules by keyword / semantic similarity
   */
  search(query: RetrievalQuery): Promise<RulesChunk[]>;

  /**
   * Get a specific rule chunk by ID
   */
  getById(id: string): Promise<RulesChunk | null>;

  /**
   * List all chunks for a ruleset
   */
  listByRuleset(rulesetId: string): Promise<RulesChunk[]>;
}

/**
 * Placeholder implementation — returns empty results
 */
export class LocalRulesRetriever implements RulesRetriever {
  async search(_query: RetrievalQuery): Promise<RulesChunk[]> {
    // TODO: Implement keyword search over localStorage chunks
    return [];
  }

  async getById(_id: string): Promise<RulesChunk | null> {
    return null;
  }

  async listByRuleset(_rulesetId: string): Promise<RulesChunk[]> {
    return [];
  }
}
