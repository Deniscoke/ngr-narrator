import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    return NextResponse.redirect(`${origin}/auth/error?message=not_configured`);
  }

  if (code) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error && data.user) {
        // Upsert profile for Hall of Fame (ignore if profiles table doesn't exist yet)
        const { error: profileErr } = await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            display_name: data.user.user_metadata?.full_name ?? data.user.user_metadata?.name ?? data.user.email?.split("@")[0] ?? "Hráč",
            avatar_url: data.user.user_metadata?.avatar_url ?? null,
            email: data.user.email ?? null,
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: "id" }
        );
        if (profileErr) console.warn("[auth] profile upsert skipped:", profileErr.message);

        const forwardedHost = request.headers.get("x-forwarded-host");
        const isLocalEnv = process.env.NODE_ENV === "development";
        if (isLocalEnv) {
          return NextResponse.redirect(`${origin}${next}`);
        }
        if (forwardedHost) {
          return NextResponse.redirect(`https://${forwardedHost}${next}`);
        }
        return NextResponse.redirect(`${origin}${next}`);
      }
    } catch {
      // ignore
    }
  }

  return NextResponse.redirect(`${origin}/auth/error?message=auth_failed`);
}
