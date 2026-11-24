import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/**
 * Where links in Supabase emails land (confirm email, reset password).
 * We turn the one-time code in the link into a login session, then send
 * the person on to `next`.
 *
 * Two link styles are supported:
 *  - ?code=...                 (Supabase's default email templates)
 *  - ?token_hash=...&type=...  (optional custom templates, see README)
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNextPath(searchParams.get("next"));

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, origin));
  } else if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(next, origin));
  }

  // The link expired, was already used, or was opened in another browser.
  const fallback = next.startsWith("/reset-password")
    ? "/reset-password?error=link"
    : "/login?message=link";
  return NextResponse.redirect(new URL(fallback, origin));
}
