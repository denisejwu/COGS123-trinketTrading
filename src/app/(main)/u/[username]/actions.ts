"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText } from "@/lib/validation";

/** "Add friend" / "Remove friend". */
export async function toggleFriend(formData: FormData) {
  const userId = await requireUserId();
  const friendId = formText(formData, "friend_id");
  const username = formText(formData, "username");
  if (!friendId || friendId === userId) return;

  const supabase = await createClient();
  if (formText(formData, "is_friend") === "true") {
    await supabase.from("friends").delete().eq("user_id", userId).eq("friend_id", friendId);
  } else {
    await supabase.from("friends").insert({ user_id: userId, friend_id: friendId });
  }
  revalidatePath(`/u/${username}`);
}
