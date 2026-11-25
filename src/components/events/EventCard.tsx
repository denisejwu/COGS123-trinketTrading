import Link from "next/link";
import { CalendarDays, Users } from "lucide-react";
import { LocalTime } from "@/components/LocalTime";
import { EVENT_STATUS_LABEL, EVENT_TYPES } from "@/lib/event-types";
import type { EventSummary } from "@/lib/events";

/** An event in a list: type icon, title, time, status and how many are going. */
export function EventCard({ event, showCommunity = false }: { event: EventSummary; showCommunity?: boolean }) {
  const meta = EVENT_TYPES[event.type];
  const Icon = meta.icon;
  const status = EVENT_STATUS_LABEL[event.status];
  const going = event.event_rsvps?.[0]?.count ?? 0;

  return (
    <Link
      href={`/events/${event.id}`}
      className="flex gap-3 rounded-3xl border border-line bg-card p-4 transition-shadow hover:shadow-md"
    >
      <span
        aria-hidden="true"
        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl"
        style={{ background: meta.color.bg, color: meta.color.fg }}
      >
        <Icon size={24} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${status.className}`}>{status.label}</span>
          <span className="text-xs font-bold text-muted">{meta.label}</span>
        </div>
        <p className="font-extrabold">
          {event.title}
          {event.theme && <span className="font-normal text-muted"> · {event.theme}</span>}
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays aria-hidden="true" size={14} />
            <LocalTime iso={event.starts_at} />
          </span>
          <span className="inline-flex items-center gap-1">
            <Users aria-hidden="true" size={14} />
            {going} going
          </span>
          {showCommunity && <span>{event.community.name}</span>}
        </p>
      </div>
    </Link>
  );
}
