"use server";

import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { REVIEW_TAGS } from "@/lib/review-tags";
import { createClient } from "@/lib/supabase/server";
import { formText, type FormState } from "@/lib/validation";

/** The swap rules live in database functions; these call them. */

export async function confirmSwap(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const tradeId = formText(formData, "trade_id");
  const supabase = await createClient();
  const { data: status, error } = await supabase.rpc("confirm_swap", { p_trade_id: tradeId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/", "layout");
  return {
    status: "success",
    message: status === "completed" ? "Swap complete!" : "Confirmed! Waiting for the other person.",
  };
}

export async function cancelSwap(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const tradeId = formText(formData, "trade_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_trade", { p_trade_id: tradeId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/", "layout");
  return { status: "success", message: "Swap cancelled." };
}

export async function addProofPhoto(tradeId: string, path: string, caption: string): Promise<FormState> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase
    .from("trade_photos")
    .insert({ trade_id: tradeId, uploader_id: userId, path, caption: caption.trim() || null });
  if (error) return { status: "error", message: `Couldn't save the photo: ${error.message}` };
  revalidatePath(`/trades/${tradeId}`);
  return { status: "success" };
}

export async function leaveReview(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const tradeId = formText(formData, "trade_id");
  const rating = Number(formText(formData, "rating"));
  const comment = formText(formData, "comment");
  const allowed = new Set<string>(REVIEW_TAGS.map((t) => t.value));
  const tags = formData.getAll("tags").map(String).filter((t) => allowed.has(t));

  if (!(rating >= 1 && rating <= 5)) {
    return { status: "error", message: "Pick 1 to 5 stars.", values: { comment } };
  }
  if (comment.length > 500) {
    return { status: "error", message: "Keep the comment under 500 characters.", values: { comment } };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("leave_review", {
    p_trade_id: tradeId,
    p_rating: rating,
    p_tags: tags,
    p_comment: comment,
  });
  if (error) return { status: "error", message: error.message, values: { comment } };
  revalidatePath("/", "layout");
  return { status: "success", message: "Thanks for your review!" };
}
