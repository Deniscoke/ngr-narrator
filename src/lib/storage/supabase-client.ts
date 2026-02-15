// ============================================================
// Supabase Client — optional persistence layer
// ============================================================
// Install @supabase/supabase-js when ready to use:
//   npm install @supabase/supabase-js
//
// If NEXT_PUBLIC_SUPABASE_URL is not set, the app runs in local mode.
// This file uses dynamic import to avoid build errors when the
// package is not installed.
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

export async function getSupabaseClient() {
  if (client) return client;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.info("[RPG Narrator] Supabase not configured — using local mode.");
    return null;
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { createClient } = await import("@supabase/supabase-js");
    client = createClient(url, key);
    return client;
  } catch {
    console.warn("[RPG Narrator] @supabase/supabase-js not installed. Run: npm install @supabase/supabase-js");
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  return !!(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}
