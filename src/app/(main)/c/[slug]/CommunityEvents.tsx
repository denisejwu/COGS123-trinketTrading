import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { EventCard } from "@/components/events/EventCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClasses } from "@/components/ui/button";
import { EVENT_SUMMARY_SELECT, sortEvents, type EventSummary } from "@/lib/events";
import { createClient } from "@/lib/supabase/server";
import { addDemoActivity } from "./actions";

/** The Events tab: live and upcoming events first, then past ones. */
export async function CommunityEvents({
  communityId,
  communitySlug,
  isMember,
}: {
  communityId: string;
  communitySlug: string;
  isMember: boolean;
}) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("events")
    .select(EVENT_SUMMARY_SELECT)
    .eq("community_id", communityId)
    .limit(50);
  if (error) throw new Error(`Couldn't load events: ${error.message}`);
  const events = sortEvents((data ?? []) as unknown as EventSummary[]);
  const current = events.filter((e) => e.status !== "ended");
  const past = events.filter((e) => e.status === "ended");

  return (
    <div className="space-y-5">
      {isMember && (
        <Link href={`/c/${communitySlug}/events/new`} className={buttonClasses("primary")}>
          <Plus aria-hidden="true" size={18} />
          Create an event
        </Link>
      )}

      {current.length === 0 ? (
        <EmptyState icon={<CalendarDays size={22} />} title="No upcoming events">
          {isMember ? "Start one: a swap meet, mystery swap, unboxing party, contest or theme day." : "Join to create one!"}
        </EmptyState>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {current.map((event) => (
            <li key={event.id}>
              <EventCard event={event} />
            </li>
          ))}
        </ul>
      )}

      {isMember && (
        <form
          action={addDemoActivity}
          className="flex flex-col gap-3 rounded-3xl border border-dashed border-line p-4 sm:flex-row sm:items-center"
        >
          <input type="hidden" name="community_id" value={communityId} />
          <input type="hidden" name="slug" value={communitySlug} />
          <p className="flex-1 text-sm text-muted">
            <strong className="text-navy">Testing on your own?</strong> Add practice traders and a live Swap Meet,
            Showcase Contest and Mystery Swap to this room.
          </p>
          <SubmitButton variant="secondary" pendingText="Adding…">
            Add practice activity
          </SubmitButton>
        </form>
      )}

      {past.length > 0 && (
        <details>
          <summary className="cursor-pointer font-extrabold">Past events ({past.length})</summary>
          <ul className="mt-3 grid gap-3 md:grid-cols-2">
            {past.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
