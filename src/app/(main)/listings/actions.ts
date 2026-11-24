"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getMyProfile, requireUserId } from "@/lib/auth";
import { isCondition, UUID_PATTERN } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { formText, type FormState } from "@/lib/validation";

/** Reads and checks the listing form. Shared by "create" and "edit". */
function readListingForm(formData: FormData, userId: string) {
  const values = {
    community_id: formText(formData, "community_id"),
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    condition: formText(formData, "condition"),
    size: formText(formData, "size"),
    looking_for: formText(formData, "looking_for"),
    for_trade: formText(formData, "for_trade") === "false" ? "false" : "true",
  };
  const imagePaths = formData
    .getAll("image_paths")
    .map(String)
    .filter(Boolean);

  const fieldErrors: Record<string, string> = {};
  if (values.title.length < 3 || values.title.length > 80) fieldErrors.title = "Use 3 to 80 characters.";
  if (!UUID_PATTERN.test(values.community_id)) fieldErrors.community_id = "Choose a community.";
  if (!isCondition(values.condition)) fieldErrors.condition = "Choose a condition.";
  if (values.description.length > 1000) fieldErrors.description = "Keep it under 1000 characters.";
  if (values.size.length > 60) fieldErrors.size = "Keep it under 60 characters.";
  if (values.looking_for.length > 200) fieldErrors.looking_for = "Keep it under 200 characters.";
  if (imagePaths.length < 1) fieldErrors.photos = "Add at least one photo.";
  if (imagePaths.length > 4) fieldErrors.photos = "You can add up to 4 photos.";
  if (imagePaths.some((p) => !p.startsWith(`${userId}/`))) fieldErrors.photos = "Please re-upload your photos.";

  // Only keep "looking for" on listings that are up for trade.
  if (values.for_trade === "false") values.looking_for = "";

  return { values, imagePaths, fieldErrors };
}

function rpcArgs(values: ReturnType<typeof readListingForm>["values"], imagePaths: string[]) {
  return {
    p_community_id: values.community_id,
    p_title: values.title,
    p_description: values.description,
    p_condition: values.condition as "sealed" | "like_new" | "gently_used" | "well_loved",
    p_size: values.size,
    p_looking_for: values.looking_for,
    p_for_trade: values.for_trade === "true",
    p_image_paths: imagePaths,
  };
}

// ---------------------------------------------------------------------------
export async function createListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const { values, imagePaths, fieldErrors } = readListingForm(formData, userId);
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: listingId, error } = await supabase.rpc("create_listing", rpcArgs(values, imagePaths));
  if (error || !listingId) {
    return { status: "error", message: error?.message ?? "Couldn't post your listing.", values };
  }

  revalidatePath("/", "layout");
  redirect(`/listings/${listingId}`);
}

// ---------------------------------------------------------------------------
export async function updateListing(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const listingId = formText(formData, "listing_id");
  const { values, imagePaths, fieldErrors } = readListingForm(formData, userId);
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data: removedPaths, error } = await supabase.rpc("update_listing", {
    p_listing_id: listingId,
    ...rpcArgs(values, imagePaths),
  });
  if (error) return { status: "error", message: error.message, values };

  // Clean up photos that were taken off the listing.
  if (removedPaths && removedPaths.length > 0) {
    await supabase.storage.from("listing-images").remove(removedPaths);
  }

  revalidatePath("/", "layout");
  redirect(`/listings/${listingId}`);
}

// ---------------------------------------------------------------------------
export async function deleteListing(formData: FormData) {
  await requireUserId();
  const listingId = formText(formData, "listing_id");
  const supabase = await createClient();

  const { data: images } = await supabase
    .from("listing_images")
    .select("path")
    .eq("listing_id", listingId);

  // Security rules only allow deleting your own *available* listing.
  const { data: deleted } = await supabase.from("listings").delete().eq("id", listingId).select("id");

  if (deleted && deleted.length > 0 && images && images.length > 0) {
    await supabase.storage.from("listing-images").remove(images.map((i) => i.path));
  }

  const me = await getMyProfile();
  revalidatePath("/", "layout");
  redirect(me ? `/u/${me.username}` : "/");
}

// ---------------------------------------------------------------------------
export async function addComment(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const listingId = formText(formData, "listing_id");
  const body = formText(formData, "body");

  if (!body) return { status: "error", message: "Write a comment first." };
  if (body.length > 500) {
    return { status: "error", message: "Keep comments under 500 characters.", values: { body } };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("listing_comments")
    .insert({ listing_id: listingId, author_id: userId, body });
  if (error) return { status: "error", message: `Couldn't post: ${error.message}`, values: { body } };

  revalidatePath(`/listings/${listingId}`);
  return { status: "success", message: "Comment posted." };
}

export async function deleteComment(formData: FormData) {
  await requireUserId();
  const supabase = await createClient();
  await supabase.from("listing_comments").delete().eq("id", formText(formData, "comment_id"));
  revalidatePath(`/listings/${formText(formData, "listing_id")}`);
}
