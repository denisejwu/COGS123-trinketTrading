"use server";

/**
 * Prototype login: type a name, get an account.
 *
 * This uses Supabase "anonymous sign-in": it creates a real user with a
 * login session but no email or password. The name travels along as
 * metadata, and our database trigger turns it into a profile with a
 * username like "denise_4821". Each browser keeps its own session, so a
 * normal window and an Incognito window are two different people.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient as createPlainClient, type AuthError, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { formText, safeNextPath, type FormState } from "@/lib/validation";

/** Friendly messages for the sign-in errors people might actually hit. */
function signInErrorMessage(error: AuthError) {
  if (error.code === "anonymous_provider_disabled") {
    return (
      "Name-only sign-in is switched off in Supabase. Turn on Authentication → Sign In / Providers → " +
      "“Allow anonymous sign-ins”, then try again."
    );
  }
  if (error.code === "over_request_rate_limit") {
    return "Too many new accounts from this Wi-Fi right now. The host can raise the limit in Supabase (Authentication → Rate Limits).";
  }
  return error.message;
}

function checkName(displayName: string) {
  return displayName.length < 2 || displayName.length > 50 ? "Use 2 to 50 characters." : null;
}

// ---------------------------------------------------------------------------
export async function startWithName(_prev: FormState, formData: FormData): Promise<FormState> {
  const displayName = formText(formData, "display_name");
  const next = safeNextPath(formText(formData, "next"));
  const values = { display_name: displayName };

  const nameError = checkName(displayName);
  if (nameError) return { status: "error", fieldErrors: { display_name: nameError }, values };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  });
  if (error) return { status: "error", message: signInErrorMessage(error), values };

  revalidatePath("/", "layout");
  redirect(next);
}

// ---------------------------------------------------------------------------
/**
 * The QR code "join a room" flow: create a name-only account if needed,
 * add the person to the community (the room), and drop them inside.
 */
export async function joinRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const slug = formText(formData, "slug");
  const displayName = formText(formData, "display_name");
  const values = { display_name: displayName };

  const supabase = await createClient();
  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).maybeSingle();
  if (!community) return { status: "error", message: "This room doesn't exist any more.", values };

  // Already logged in on this browser? Just join. Otherwise make an account.
  const { data: claims } = await supabase.auth.getClaims();
  let userId = claims?.claims?.sub ?? null;
  let db: SupabaseClient<Database> = supabase;

  if (!userId) {
    const nameError = checkName(displayName);
    if (nameError) return { status: "error", fieldErrors: { display_name: nameError }, values };

    const { data, error } = await supabase.auth.signInAnonymously({
      options: { data: { display_name: displayName } },
    });
    if (error || !data.user || !data.session) {
      return { status: "error", message: error ? signInErrorMessage(error) : "Couldn't sign in.", values };
    }
    userId = data.user.id;
    // Use the brand-new login token directly for the "join" step, so it
    // doesn't depend on the login cookie being readable yet.
    const { url, key } = supabaseEnv();
    db = createPlainClient<Database>(url, key, {
      global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
      auth: { persistSession: false },
    });
  }

  const { error: joinError } = await db
    .from("community_members")
    .upsert({ community_id: community.id, user_id: userId }, { ignoreDuplicates: true });
  if (joinError) return { status: "error", message: `Couldn't join: ${joinError.message}`, values };

  revalidatePath("/", "layout");
  redirect(`/c/${slug}?welcome=1`);
}
