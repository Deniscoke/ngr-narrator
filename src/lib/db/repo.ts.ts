import { getSupabase } from "./supabase";
import type { NarrationEntry, NarrationMode, Campaign } from "./types";

export async function ensureCampaignMemory(campaignId: string) {
    const sb = getSupabase();
    const { data } = await sb
        .from("campaign_memory")
        .select("campaign_id, summary")
        .eq("campaign_id", campaignId)
        .maybeSingle();

    if (data) return data.summary || "";

    const { error } = await sb.from("campaign_memory").insert({
        campaign_id: campaignId,
        summary: "",
    });

    if (error) throw error;
    return "";
}

export async function getCampaignMemory(campaignId: string) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("campaign_memory")
        .select("summary")
        .eq("campaign_id", campaignId)
        .maybeSingle();

    if (error) throw error;
    return data?.summary || "";
}

export async function setCampaignMemory(campaignId: string, summary: string) {
    const sb = getSupabase();
    const { error } = await sb.from("campaign_memory").upsert({
        campaign_id: campaignId,
        summary,
        updated_at: new Date().toISOString(),
    });

    if (error) throw error;
}

export async function getRecentNarrations(campaignId: string, limit = 20) {
    const sb = getSupabase();
    const { data, error } = await sb
        .from("narrations")
        .select("id,campaign_id,mode,player_input,narrator_output,choices,created_at")
        .eq("campaign_id", campaignId)
        .order("created_at", { ascending: false })
        .limit(limit);

    if (error) throw error;

    // vr�time chronologicky (od najstar�ej)
    return (data as any as NarrationEntry[]).reverse();
}

export async function addNarrationEntry(args: {
    campaignId: string;
    mode: NarrationMode;
    playerInput: string;
    narratorOutput: string;
    choices: string[];
}) {
    const sb = getSupabase();
    const { error } = await sb.from("narrations").insert({
        campaign_id: args.campaignId,
        mode: args.mode,
        player_input: args.playerInput,
        narrator_output: args.narratorOutput,
        choices: args.choices,
    });

    if (error) throw error;
}

export function updateSummaryLocally(prev: string, newLine: string) {
    // jednoduch�: pridaj riadok a ore� na rozumn� d�ku
    const merged = (prev ? prev.trim() + "\n" : "") + newLine.trim();
    const maxChars = 1200; // dr��me kr�tke
    return merged.length > maxChars ? merged.slice(merged.length - maxChars) : merged;
}

// ============================================================
// Similarity retrieval — simple keyword-based search
// ============================================================
// Uses Supabase ilike/textSearch to find narrations whose
// player_input or narrator_output contain tokens from the query.
// This is a pragmatic first step; can be upgraded to pgvector
// embeddings later without changing the caller contract.
// ============================================================

import type { CompactNarrationEntry } from "@/lib/ai/provider";

/**
 * Search past narrations by keyword overlap with the current user input.
 * Returns up to `limit` entries, excluding the most recent ones (which are
 * already supplied as `recentEntries`).
 */
export async function searchSimilarNarrations(
    campaignId: string,
    userInput: string,
    limit = 5,
    skipRecent = 10
): Promise<CompactNarrationEntry[]> {
    const sb = getSupabase();

    // Extract meaningful tokens (3+ chars, deduplicated)
    const tokens = Array.from(
        new Set(
            userInput
                .toLowerCase()
                .replace(/[^\p{L}\p{N}\s]/gu, " ")
                .split(/\s+/)
                .filter((t) => t.length >= 3)
        )
    ).slice(0, 6); // max 6 tokens to keep query manageable

    if (tokens.length === 0) return [];

    // Build OR-based ilike filter over player_input
    // Supabase JS doesn't support native OR-ilike across columns easily,
    // so we use .or() with ilike patterns.
    const orClauses = tokens.map((t) => `player_input.ilike.%${t}%`).join(",");

    const { data, error } = await sb
        .from("narrations")
        .select("player_input, narrator_output, created_at")
        .eq("campaign_id", campaignId)
        .or(orClauses)
        .order("created_at", { ascending: false })
        .range(skipRecent, skipRecent + limit - 1);

    if (error) {
        console.warn("[searchSimilarNarrations] query failed:", error.message);
        return [];
    }

    return (data || []).map((row: any) => ({
        userInput: row.player_input,
        narrationText: row.narrator_output,
        createdAt: row.created_at,
    }));
}
