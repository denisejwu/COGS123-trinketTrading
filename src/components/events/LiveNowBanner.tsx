import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EVENT_TYPES } from "@/lib/event-types";
import { createClient } from "@/lib/supabase/server";

/**
 * "Live now" strip at the top of a room: events happening right now, so
 * people can jump straight in during a prototyping session.
 */
export async function LiveNowBanner({ communityId }: { communityId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("events")
    .select("id, title, type")
    .eq("community_id", communityId)
    .eq("status", "live")
    .order("starts_at", { ascending: false })
    .limit(4);
  if (!data || data.length === 0) return null;

  return (
    <section
      aria-label="Events happening now"
      className="flex flex-wrap items-center gap-2 rounded-3xl bg-navy p-3 text-white"
    >
      <span className="inline-flex items-center gap-1.5 px-1 text-sm font-extrabold">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 animate-pulse rounded-full bg-danger"
        />
        Live now
      </span>
      {data.map((event) => {
        const Icon = EVENT_TYPES[event.type].icon;
        return (
          <Link
            key={event.id}
            href={`/events/${event.id}`}
            className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-bold text-navy hover:bg-accent-soft"
          >
            <Icon aria-hidden="true" size={14} />
            {event.title}
            <ArrowRight aria-hidden="true" size={14} />
          </Link>
        );
      })}
    </section>
  );
}
