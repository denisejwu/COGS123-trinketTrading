"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireUserId } from "@/lib/auth";
import { isEventType } from "@/lib/event-types";
import { UUID_PATTERN } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { formText, type FormState } from "@/lib/validation";

/** Event rules live in database functions (0005_events.sql); these call them. */

function refreshEvent(eventId: string) {
  revalidatePath(`/events/${eventId}`);
}

// ---------------------------------------------------------------------------
export async function createEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const values = {
    community_id: formText(formData, "community_id"),
    slug: formText(formData, "slug"),
    type: formText(formData, "type"),
    title: formText(formData, "title"),
    description: formText(formData, "description"),
    theme: formText(formData, "theme"),
    starts_at: formText(formData, "starts_at"),
    place: formText(formData, "place"),
    mini_activity: formText(formData, "mini_activity"),
  };

  const fieldErrors: Record<string, string> = {};
  if (!isEventType(values.type)) fieldErrors.type = "Pick a kind of event.";
  if (values.title.length < 3 || values.title.length > 80) fieldErrors.title = "Use 3 to 80 characters.";
  if (values.description.length > 1000) fieldErrors.description = "Keep it under 1000 characters.";
  if (values.theme.length > 80) fieldErrors.theme = "Keep it under 80 characters.";
  if (Number.isNaN(Date.parse(values.starts_at))) fieldErrors.starts_at = "Pick a date and time.";
  if (values.place.length > 120) fieldErrors.place = "Keep it under 120 characters.";
  if (values.mini_activity.length > 300) fieldErrors.mini_activity = "Keep it under 300 characters.";
  if (!UUID_PATTERN.test(values.community_id)) fieldErrors.type = "Something went wrong. Reload the page.";
  if (Object.keys(fieldErrors).length) {
    return { status: "error", message: "Please fix the highlighted fields.", fieldErrors, values };
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .insert({
      community_id: values.community_id,
      created_by: userId,
      type: values.type as "swap_meet",
      title: values.title,
      description: values.description,
      theme: values.theme || null,
      starts_at: new Date(values.starts_at).toISOString(),
      place: values.place || "In the PopSwap room",
      mini_activity: values.mini_activity || null,
    })
    .select("id")
    .single();

  if (error || !data) {
    const message = error?.code === "42501" ? "Join the community to create events." : error?.message;
    return { status: "error", message: message ?? "Couldn't create the event.", values };
  }

  revalidatePath(`/c/${values.slug}`);
  redirect(`/events/${data.id}`);
}

// ---------------------------------------------------------------------------
export async function toggleRsvp(formData: FormData) {
  const userId = await requireUserId();
  const eventId = formText(formData, "event_id");
  const supabase = await createClient();
  if (formText(formData, "going") === "true") {
    await supabase.from("event_rsvps").delete().eq("event_id", eventId).eq("user_id", userId);
  } else {
    await supabase.from("event_rsvps").insert({ event_id: eventId, user_id: userId });
  }
  refreshEvent(eventId);
}

export async function addEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const eventId = formText(formData, "event_id");
  const listingId = formText(formData, "listing_id") || undefined;
  const photoPath = formText(formData, "photo_path") || undefined;
  const caption = formText(formData, "caption");

  const supabase = await createClient();
  const { error } = await supabase.rpc("add_event_entry", {
    p_event_id: eventId,
    p_listing_id: listingId,
    p_photo_path: photoPath,
    p_caption: caption,
  });
  if (error) return { status: "error", message: error.message, values: { caption } };
  refreshEvent(eventId);
  return { status: "success", message: "Added!" };
}

export async function removeEntry(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_event_entry", { p_entry_id: formText(formData, "entry_id") });
  if (error) return { status: "error", message: error.message };
  refreshEvent(formText(formData, "event_id"));
  return { status: "success" };
}

export async function toggleVote(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_event_vote", { p_entry_id: formText(formData, "entry_id") });
  if (error) return { status: "error", message: error.message };
  refreshEvent(formText(formData, "event_id"));
  return { status: "success" };
}

export async function setEventStatus(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const eventId = formText(formData, "event_id");
  const status = formText(formData, "status") as "live" | "ended";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_event_status", { p_event_id: eventId, p_status: status });
  if (error) return { status: "error", message: error.message };
  refreshEvent(eventId);
  return { status: "success" };
}

export async function revealMysterySwap(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const eventId = formText(formData, "event_id");
  const supabase = await createClient();
  const { error } = await supabase.rpc("run_mystery_swap", { p_event_id: eventId });
  if (error) return { status: "error", message: error.message };
  revalidatePath("/", "layout");
  return { status: "success", message: "Revealed!" };
}

/**
 * Delete an event you created. (A mystery swap can only be deleted while
 * its pool is empty or after the reveal, so nobody's item stays locked.)
 */
export async function deleteEvent(_prev: FormState, formData: FormData): Promise<FormState> {
  await requireUserId();
  const eventId = formText(formData, "event_id");
  const slug = formText(formData, "slug");
  const supabase = await createClient();

  const { data: event } = await supabase.from("events").select("type, status").eq("id", eventId).maybeSingle();
  if (event?.type === "mystery_swap" && event.status !== "ended") {
    const { count } = await supabase
      .from("event_entries")
      .select("id", { count: "exact", head: true })
      .eq("event_id", eventId);
    if ((count ?? 0) > 0) {
      return { status: "error", message: "Reveal the mystery swap (or wait for everyone to take their items out) before deleting it." };
    }
  }

  // Security rules only let the person who created the event delete it.
  const { data: deleted, error } = await supabase.from("events").delete().eq("id", eventId).select("id");
  if (error) return { status: "error", message: error.message };
  if (!deleted?.length) return { status: "error", message: "Only the person who created this event can delete it." };

  revalidatePath(`/c/${slug}`);
  redirect(`/c/${slug}?tab=events`);
}
