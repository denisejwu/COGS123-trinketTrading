"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText, USERNAME_PATTERN, USERNAME_RULES, type FormState } from "@/lib/validation";

/** Save the profile form (display name, username, bio, school or city). */
export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();

  const displayName = formText(formData, "display_name");
  const username = formText(formData, "username").toLowerCase();
  const bio = formText(formData, "bio");
  const location = formText(formData, "location");
  const values = { display_name: displayName, username, bio, location };

  const fieldErrors: Record<string, string> = {};
  if (!displayName) fieldErrors.display_name = "Enter a display name.";
  else if (displayName.length > 50) fieldErrors.display_name = "Keep it under 50 characters.";
  if (!USERNAME_PATTERN.test(username)) fieldErrors.username = `Usernames need ${USERNAME_RULES}.`;
  if (bio.length > 280) fieldErrors.bio = "Keep your bio under 280 characters.";
  if (location.length > 80) fieldErrors.location = "Keep it under 80 characters.";
  if (Object.keys(fieldErrors).length > 0) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("profiles")
    .update({
      display_name: displayName,
      username,
      bio: bio || null,
      location: location || null,
    })
    .eq("id", userId);

  if (error) {
    // 23505 = Postgres "unique violation": someone else has that username.
    if (error.code === "23505") {
      return {
        status: "error",
        message: "Please fix the highlighted fields.",
        fieldErrors: { username: "That username is taken. Try another one." },
        values,
      };
    }
    return { status: "error", message: `Couldn't save: ${error.message}`, values };
  }

  revalidatePath("/", "layout"); // refresh the nav (name, profile link)
  return { status: "success", message: "Profile saved.", values };
}

/**
 * Called after the browser has uploaded a new avatar to Storage.
 * Points the profile at the new file and deletes the old one.
 */
export async function saveAvatar(path: string): Promise<FormState> {
  const userId = await requireUserId();
  // Only accept files inside your own folder.
  if (!path.startsWith(`${userId}/`)) {
    return { status: "error", message: "That upload doesn't belong to you." };
  }

  const supabase = await createClient();
  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .single();

  const { error } = await supabase.from("profiles").update({ avatar_path: path }).eq("id", userId);
  if (error) return { status: "error", message: `Couldn't save your photo: ${error.message}` };

  if (current?.avatar_path && current.avatar_path !== path) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }

  revalidatePath("/", "layout");
  return { status: "success", message: "Photo updated." };
}

/** Remove your profile photo (go back to initials). */
export async function removeAvatar(): Promise<void> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", userId)
    .single();

  await supabase.from("profiles").update({ avatar_path: null }).eq("id", userId);
  if (current?.avatar_path) {
    await supabase.storage.from("avatars").remove([current.avatar_path]);
  }
  revalidatePath("/", "layout");
}
