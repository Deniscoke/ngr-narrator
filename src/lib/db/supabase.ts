import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;

export function getSupabase() {
    if (!url || !anon) {
        throw new Error("Supabase env missing: set SUPABASE_URL and SUPABASE_ANON_KEY");
    }
    return createClient(url, anon, {
        auth: { persistSession: false },
    });
}
