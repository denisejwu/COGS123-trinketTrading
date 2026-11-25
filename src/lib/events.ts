import "server-only";
import type { EventStatus, EventType } from "@/lib/event-types";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

type PersonLite = { username: string; display_name: string; avatar_path: string | null };

export type EventSummary = {
  id: string;
  type: EventType;
  title: string;
  theme: string | null;
  starts_at: string;
  status: EventStatus;
  place: string;
  community: { slug: string; name: string };
  event_rsvps: { count: number }[];
};

export const EVENT_SUMMARY_SELECT =
  "id, type, title, theme, starts_at, status, place, community:communities ( slug, name ), event_rsvps ( count )";

/** Sort: live first, then upcoming (soonest first), then ended (latest first). */
export function sortEvents<T extends { status: EventStatus; starts_at: string }>(events: T[]) {
  const rank = { live: 0, upcoming: 1, ended: 2 } as const;
  return [...events].sort((a, b) => {
    if (rank[a.status] !== rank[b.status]) return rank[a.status] - rank[b.status];
    const diff = new Date(a.starts_at).getTime() - new Date(b.starts_at).getTime();
    return a.status === "ended" ? -diff : diff;
  });
}

export type EventEntry = {
  id: string;
  user_id: string;
  listing_id: string | null;
  photo_path: string | null;
  caption: string | null;
  receiver_id: string | null;
  created_at: string;
  owner: PersonLite;
  receiver: PersonLite | null;
  listing: ListingCardData | null;
};

/** Everything the event page needs. Null if the event doesn't exist. */
export async function getEvent(eventId: string, myId: string) {
  const supabase = await createClient();
  const { data: event } = await supabase
    .from("events")
    .select(
      "*, community:communities ( id, slug, name ), host:profiles!events_created_by_fkey ( username, display_name )",
    )
    .eq("id", eventId)
    .maybeSingle();
  if (!event) return null;

  const community = event.community as unknown as { id: string; slug: string; name: string };

  const [{ data: rsvps }, { data: entries }, { data: votes }, { data: canHost }, { data: membership }] =
    await Promise.all([
      supabase
        .from("event_rsvps")
        .select("user_id, profile:profiles!event_rsvps_user_id_fkey ( username, display_name, avatar_path )")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase
        .from("event_entries")
        .select(
          `id, user_id, listing_id, photo_path, caption, receiver_id, created_at,
           owner:profiles!event_entries_user_id_fkey ( username, display_name, avatar_path ),
           receiver:profiles!event_entries_receiver_id_fkey ( username, display_name, avatar_path ),
           listing:listings!event_entries_listing_id_fkey ( ${LISTING_CARD_SELECT} )`,
        )
        .eq("event_id", eventId)
        .order("created_at", { ascending: true }),
      supabase.from("event_votes").select("entry_id, voter_id").eq("event_id", eventId),
      supabase.rpc("can_host_event", { p_event_id: eventId }),
      supabase
        .from("community_members")
        .select("user_id")
        .eq("community_id", community.id)
        .eq("user_id", myId)
        .maybeSingle(),
    ]);

  const voteRows = votes ?? [];
  const voteCount = (entryId: string) => voteRows.filter((v) => v.entry_id === entryId).length;

  return {
    id: event.id,
    type: event.type as EventType,
    title: event.title,
    description: event.description,
    theme: event.theme,
    startsAt: event.starts_at,
    place: event.place,
    miniActivity: event.mini_activity,
    status: event.status as EventStatus,
    revealedAt: event.revealed_at,
    community,
    host: (event.host as unknown as { username: string; display_name: string } | null) ?? null,
    canHost: Boolean(canHost),
    /** Only the person who created the event can delete it. */
    isCreator: event.created_by === myId,
    isMember: Boolean(membership),
    going: (rsvps ?? []).map((r) => ({ userId: r.user_id, ...(r.profile as unknown as PersonLite) })),
    imGoing: (rsvps ?? []).some((r) => r.user_id === myId),
    entries: ((entries ?? []) as unknown as EventEntry[]).map((e) => ({
      ...e,
      votes: voteCount(e.id),
      iVoted: voteRows.some((v) => v.entry_id === e.id && v.voter_id === myId),
    })),
  };
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEvent>>>;
