"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText, type FormState } from "@/lib/validation";

/** "Start a community" form. */
export async function createCommunity(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const name = formText(formData, "name");
  const description = formText(formData, "description");
  const coverPath = formText(formData, "cover_path") || null;
  const values = { name, description, cover_path: coverPath ?? "" };

  const fieldErrors: Record<string, string> = {};
  if (name.length < 3 || name.length > 50) fieldErrors.name = "Use 3 to 50 characters.";
  if (description.length < 10) fieldErrors.description = "Tell people what it's about (at least 10 characters).";
  if (description.length > 500) fieldErrors.description = "Keep it under 500 characters.";
  if (coverPath && !coverPath.startsWith(`${userId}/`)) fieldErrors.cover_path = "Please upload the cover again.";
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: slug, error } = await supabase.rpc("create_community", {
    p_name: name,
    p_description: description,
    p_cover_path: coverPath ?? undefined,
  });

  if (error || !slug) {
    // Our database function sends back friendly messages (e.g. name already taken).
    return { status: "error", message: error?.message ?? "Couldn't create the community.", values };
  }

  revalidatePath("/communities");
  redirect(`/c/${slug}`);
}
