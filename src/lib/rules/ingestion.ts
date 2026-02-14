// ============================================================
// Rules Ingestion Pipeline — SKELETON ONLY
// ============================================================
// Flow: PDF → Extract text → Chunk → Paraphrase → Store
//
// This module will be implemented when we add:
// 1. PDF text extraction (pdf-parse or similar)
// 2. Text chunking (by section / heading)
// 3. Paraphrasing layer (to avoid copyright issues)
// 4. Storage (localStorage or Supabase with embeddings)
//
// IMPORTANT: All stored content must be paraphrased.
// Never store verbatim excerpts from source PDFs.
// ============================================================

import { RulesChunk } from "@/types";

export interface IngestionConfig {
  rulesetId: string;
  sourcePath: string;
  chunkSize: number;       // target characters per chunk
  overlapSize: number;     // overlap between chunks
}

/**
 * Future: Extract text from a PDF file
 */
export async function extractTextFromPDF(
  _filePath: string
): Promise<string> {
  // TODO: Implement with pdf-parse or pdfjs-dist
  throw new Error("PDF extraction not yet implemented");
}

/**
 * Future: Split text into overlapping chunks
 */
export function chunkText(
  _text: string,
  _config: Pick<IngestionConfig, "chunkSize" | "overlapSize">
): string[] {
  // TODO: Implement section-aware chunking
  throw new Error("Text chunking not yet implemented");
}

/**
 * Future: Paraphrase a text chunk (required for copyright safety)
 */
export async function paraphraseChunk(
  _chunk: string
): Promise<string> {
  // TODO: Call AI API to rephrase content
  throw new Error("Paraphrasing not yet implemented");
}

/**
 * Future: Full ingestion pipeline
 */
export async function ingestRuleset(
  _config: IngestionConfig
): Promise<RulesChunk[]> {
  // 1. extractTextFromPDF(config.sourcePath)
  // 2. chunkText(text, config)
  // 3. paraphraseChunk(chunk) for each chunk
  // 4. Store chunks via repository
  throw new Error("Ingestion pipeline not yet implemented");
}
