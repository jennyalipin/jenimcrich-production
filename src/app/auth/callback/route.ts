/**
 * OAuth callback (Sign in with Google).
 *
 * Supabase redirects here with a `code` after the provider round-trip. We
 * exchange it for a session, then enforce the invite-only rule: a Google
 * account that doesn't match a pre-provisioned `profiles` row gets signed
 * straight back out (RLS would deny them everything anyway) with a clear
 * message, rather than landing on an empty, broken-looking app.
 */

import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow a same-origin relative path — never an absolute or
  // protocol-relative URL (open-redirect guard).
  const rawNext = searchParams.get("next") ?? "/dashboard";
  const next =
    rawNext.startsWith("/") && !rawNext.startsWith("//") && !rawNext.startsWith("/\\")
      ? rawNext
      : "/dashboard";

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=oauth`);
  }

  // Invite-only: require a linked staff profile for this account.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();

  if (!profile) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=not_authorized`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
