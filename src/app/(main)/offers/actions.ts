"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { isRarity } from "@/lib/fairness";
import { createClient } from "@/lib/supabase/server";
import type { ListingRarity } from "@/lib/types";
import { formText, type FormState } from "@/lib/validation";

/** All the trade rules live in database functions; these just call them. */

function selectedIds(formData: FormData) {
  return formData.getAll("listing_ids").map(String).filter(Boolean);
}

// ---------------------------------------------------------------------------
export async function startOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const listingId = formText(formData, "listing_id");
  const message = formText(formData, "message");

  const supabase = await createClient();
  const { data: offerId, error } = await supabase.rpc("start_offer", {
    p_listing_id: listingId,
    p_listing_ids: selectedIds(formData),
    p_message: message,
  });
  if (error || !offerId) {
    return { status: "error", message: error?.message ?? "Couldn't send your offer.", values: { message } };
  }

  revalidatePath("/offers");
  redirect(`/offers/${offerId}`);
}

// ---------------------------------------------------------------------------
export async function counterOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const offerId = formText(formData, "offer_id");
  const message = formText(formData, "message");

  const supabase = await createClient();
  const { error } = await supabase.rpc("counter_offer", {
    p_offer_id: offerId,
    p_listing_ids: selectedIds(formData),
    p_message: message,
  });
  if (error) return { status: "error", message: error.message, values: { message } };

  revalidatePath(`/offers/${offerId}`);
  redirect(`/offers/${offerId}`);
}

// ---------------------------------------------------------------------------
// Accept / decline / cancel. They return a FormState so the button can
// show an error (e.g. "Some items are no longer available").
export async function acceptOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const offerId = formText(formData, "offer_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("accept_offer", { p_offer_id: offerId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/", "layout");
  return { status: "success", message: "Offer accepted!" };
}

export async function declineOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const offerId = formText(formData, "offer_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("decline_offer", { p_offer_id: offerId });
  if (error) return { status: "error", message: error.message };
  revalidatePath(`/offers/${offerId}`);
  revalidatePath("/offers");
  return { status: "success", message: "Offer declined." };
}

export async function cancelOffer(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const offerId = formText(formData, "offer_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_offer", { p_offer_id: offerId });
  if (error) return { status: "error", message: error.message };
  revalidatePath(`/offers/${offerId}`);
  revalidatePath("/offers");
  return { status: "success", message: "Offer cancelled." };
}

// ---------------------------------------------------------------------------
/** "I want this" heart: adds or removes your heart. */
export async function toggleWant(formData: FormData) {
  const userId = await requireUserId();
  const listingId = formText(formData, "listing_id");
  const supabase = await createClient();

  if (formText(formData, "wanted") === "true") {
    await supabase.from("listing_wants").delete().eq("listing_id", listingId).eq("user_id", userId);
  } else {
    await supabase.from("listing_wants").insert({ listing_id: listingId, user_id: userId });
  }
  revalidatePath(`/listings/${listingId}`);
}

/** Rarity vote: pick a rarity, or click your current pick again to remove it. */
export async function voteRarity(formData: FormData) {
  const userId = await requireUserId();
  const listingId = formText(formData, "listing_id");
  const rarity = formText(formData, "rarity");
  const current = formText(formData, "current");
  const supabase = await createClient();

  if (!isRarity(rarity) || rarity === "unsure") return;
  if (rarity === current) {
    await supabase.from("listing_rarity_votes").delete().eq("listing_id", listingId).eq("voter_id", userId);
  } else {
    await supabase
      .from("listing_rarity_votes")
      .upsert({ listing_id: listingId, voter_id: userId, rarity: rarity as ListingRarity });
  }
  revalidatePath(`/listings/${listingId}`);
}
