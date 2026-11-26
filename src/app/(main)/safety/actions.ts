"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText, type FormState } from "@/lib/validation";

/** Report a person or a listing. Saved for review (Supabase → Table Editor → reports). */
export async function reportContent(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const reason = formText(formData, "reason");
  if (reason.length < 3) return { status: "error", message: "Tell us briefly what's wrong." };
  if (reason.length > 500) return { status: "error", message: "Keep it under 500 characters.", values: { reason } };

  const supabase = await createClient();
  const { error } = await supabase.from("reports").insert({
    reporter_id: userId,
    reported_user_id: formText(formData, "user_id") || null,
    listing_id: formText(formData, "listing_id") || null,
    reason,
  });
  if (error) return { status: "error", message: `Couldn't send the report: ${error.message}`, values: { reason } };
  return { status: "success", message: "Thanks. Your report was sent to the PopSwap team." };
}

/** Block or unblock someone. Blocked people can't send you offers or messages. */
export async function toggleBlock(formData: FormData) {
  const userId = await requireUserId();
  const otherId = formText(formData, "user_id");
  const supabase = await createClient();
  if (formText(formData, "blocked") === "true") {
    await supabase.from("blocks").delete().eq("blocker_id", userId).eq("blocked_id", otherId);
  } else {
    await supabase.from("blocks").insert({ blocker_id: userId, blocked_id: otherId });
  }
  revalidatePath(`/u/${formText(formData, "username")}`);
}
