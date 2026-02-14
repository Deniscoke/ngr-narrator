// ============================================================
// Narrator Engine — placeholder logic
// ============================================================
// Future: connects to AI API + rules retriever to generate
// contextualized RPG narration.
// ============================================================

export interface NarrationRequest {
  campaignId: string;
  prompt: string;
  context?: {
    recentEvents?: string[];
    activeCharacters?: string[];
    currentScene?: string;
  };
}

export interface NarrationResponse {
  text: string;
  suggestedActions?: string[];
  rulesReferenced?: string[];
}

/**
 * Placeholder narrator — returns mock output.
 * Will be replaced with AI-powered generation.
 */
export async function generateNarration(
  request: NarrationRequest
): Promise<NarrationResponse> {
  // Simulate processing delay
  await new Promise((r) => setTimeout(r, 800));

  return {
    text: `[Placeholder] Rozprávač reaguje na: "${request.prompt}"`,
    suggestedActions: [
      "Preskúmať okolie",
      "Hovoriť s miestnym NPC",
      "Pripraviť sa na boj",
    ],
    rulesReferenced: [],
  };
}
