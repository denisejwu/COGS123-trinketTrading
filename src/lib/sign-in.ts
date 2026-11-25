import { createClient } from "@/lib/supabase/client";

/**
 * Name-only sign-in, run IN THE BROWSER (not on the server).
 *
 * Why the browser: Supabase limits new anonymous accounts per network
 * address. If our server created every account, all 50 people in a room
 * would look like ONE address (Vercel's) and share one limit. From the
 * browser, each phone counts on its own.
 *
 * The name (and optional school/city) travel along as metadata; the
 * database turns them into a filled-in profile.
 * Returns an error message to show, or null on success.
 */
export async function signInWithName(displayName: string, location = ""): Promise<string | null> {
  const name = displayName.trim();
  if (name.length < 2 || name.length > 50) return "Use 2 to 50 characters for your name.";
  if (location.trim().length > 80) return "Keep your school or city under 80 characters.";

  const supabase = createClient();
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: name, location: location.trim() } },
  });
  if (!error) return null;

  if (error.code === "anonymous_provider_disabled") {
    return (
      "Name-only sign-in is switched off in Supabase. Turn on Authentication → Sign In / Providers → " +
      "“Allow anonymous sign-ins”, then try again."
    );
  }
  if (error.code === "over_request_rate_limit" || error.status === 429) {
    return "Too many new accounts from this network right now. Try switching to mobile data, or wait a few minutes.";
  }
  return error.message;
}
