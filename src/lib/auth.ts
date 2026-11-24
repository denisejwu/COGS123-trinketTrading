import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Helpers for "who is logged in?" on the server.
 *
 * `cache()` means that if several components ask during the same request,
 * we only hit Supabase once.
 */

/** The logged-in user's id, or null if nobody is logged in. */
export const getUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  // getClaims() verifies the login token instead of trusting the cookie blindly.
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ?? null;
});

/** The logged-in user's email (shown in Settings), or null. */
export const getUserEmail = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return (data?.claims?.email as string | undefined) ?? null;
});

/** The logged-in user's profile row, or null if logged out. */
export const getMyProfile = cache(async () => {
  const userId = await getUserId();
  if (!userId) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();

  if (error) throw new Error(`Could not load your profile: ${error.message}`);
  if (!data) {
    // Logged in but no profile row: almost always means the account was
    // created before migration 0001 was run.
    throw new Error(
      "Your account has no profile. Make sure supabase/migrations/0001_profiles.sql " +
        "has been run, then sign up with a new account.",
    );
  }
  return data;
});

/** For pages that require login: returns your profile or sends you to /login. */
export async function requireProfile() {
  const profile = await getMyProfile();
  if (!profile) redirect("/login");
  return profile;
}

/** For Server Actions: returns your user id or sends you to /login. */
export async function requireUserId() {
  const userId = await getUserId();
  if (!userId) redirect("/login");
  return userId;
}
