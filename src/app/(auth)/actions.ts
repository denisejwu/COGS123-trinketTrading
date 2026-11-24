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
import { createClient } from "@/lib/supabase/server";
import { formText, safeNextPath, type FormState } from "@/lib/validation";

export async function startWithName(_prev: FormState, formData: FormData): Promise<FormState> {
  const displayName = formText(formData, "display_name");
  const next = safeNextPath(formText(formData, "next"));
  const values = { display_name: displayName };

  if (displayName.length < 2 || displayName.length > 50) {
    return {
      status: "error",
      fieldErrors: { display_name: "Use 2 to 50 characters." },
      values,
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInAnonymously({
    options: { data: { display_name: displayName } },
  });

  if (error) {
    if (error.code === "anonymous_provider_disabled") {
      return {
        status: "error",
        message:
          "Name-only sign-in is switched off in Supabase. Turn on Authentication → Sign In / Providers → " +
          "“Allow anonymous sign-ins”, then try again.",
        values,
      };
    }
    if (error.code === "over_request_rate_limit") {
      return { status: "error", message: "Too many new accounts from this network. Try again in a while.", values };
    }
    return { status: "error", message: error.message, values };
  }

  revalidatePath("/", "layout");
  redirect(next);
}
