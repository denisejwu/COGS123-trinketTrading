"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formText, type FormState } from "@/lib/validation";

/** Refresh every page that shows community membership. */
function refreshCommunity(slug: string) {
  revalidatePath(`/c/${slug}`);
  revalidatePath("/communities");
  revalidatePath("/");
}

export async function joinCommunity(formData: FormData) {
  const userId = await requireUserId();
  const supabase = await createClient();
  await supabase
    .from("community_members")
    .upsert(
      { community_id: formText(formData, "community_id"), user_id: userId },
      { ignoreDuplicates: true },
    );
  refreshCommunity(formText(formData, "slug"));
}

export async function leaveCommunity(formData: FormData) {
  const userId = await requireUserId();
  const supabase = await createClient();
  await supabase
    .from("community_members")
    .delete()
    .eq("community_id", formText(formData, "community_id"))
    .eq("user_id", userId);
  refreshCommunity(formText(formData, "slug"));
}

/** Start a discussion thread, or reply to one (when parent_id is set). */
export async function addPost(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const body = formText(formData, "body");
  const parentId = formText(formData, "parent_id") || null;

  if (!body) return { status: "error", message: "Write something first." };
  if (body.length > 2000) {
    return { status: "error", message: "Keep it under 2000 characters.", values: { body } };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("community_posts").insert({
    community_id: formText(formData, "community_id"),
    author_id: userId,
    parent_id: parentId,
    body,
  });

  if (error) {
    // 42501 = blocked by a security rule: here, not a member.
    const message =
      error.code === "42501" ? "Join this community to post." : `Couldn't post: ${error.message}`;
    return { status: "error", message, values: { body } };
  }

  revalidatePath(`/c/${formText(formData, "slug")}`);
  return { status: "success", message: parentId ? "Reply posted." : "Posted!" };
}

export async function deletePost(formData: FormData) {
  await requireUserId();
  const supabase = await createClient();
  // Security rules make sure this only deletes your own post.
  await supabase.from("community_posts").delete().eq("id", formText(formData, "post_id"));
  revalidatePath(`/c/${formText(formData, "slug")}`);
}
