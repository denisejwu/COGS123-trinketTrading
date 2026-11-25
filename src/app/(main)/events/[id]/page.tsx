import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, Crown, Gift, MapPin, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { AddEntryForm } from "@/components/events/AddEntryForm";
import { EventLive } from "@/components/events/EventLive";
import { VoteButton } from "@/components/events/VoteButton";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingTile } from "@/components/listings/ListingTile";
import { ActionButton } from "@/components/ui/ActionButton";
import { Notice } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClasses } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth";
import { EVENT_STATUS_LABEL, EVENT_TYPES } from "@/lib/event-types";
import { getEvent, type EventDetail } from "@/lib/events";
import { UUID_PATTERN } from "@/lib/listings";
import { getTradeableItems } from "@/lib/negotiations";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";
import { joinCommunity } from "../../c/[slug]/actions";
import { deleteEvent, removeEntry, revealMysterySwap, setEventStatus, toggleRsvp } from "../actions";

export async function generateMetadata({ params }: PageProps<"/events/[id]">): Promise<Metadata> {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) return { title: "Event" };
  const supabase = await createClient();
  const { data } = await supabase.from("events").select("title").eq("id", id).maybeSingle();
  return { title: data?.title ?? "Event" };
}

export default async function EventPage({ params }: PageProps<"/events/[id]">) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const myId = await requireUserId();
  const event = await getEvent(id, myId);
  if (!event) notFound();

  const meta = EVENT_TYPES[event.type];
  const Icon = meta.icon;
  const status = EVENT_STATUS_LABEL[event.status];
  const myEntries = event.entries.filter((e) => e.user_id === myId);

  return (
    <div className="space-y-6">
      <EventLive eventId={event.id} />

      <Link href={`/c/${event.community.slug}?tab=events`} className="text-sm font-bold text-accent hover:underline">
        ← {event.community.name} events
      </Link>

      {/* ---------- Header ---------- */}
      <header className="space-y-4 rounded-3xl border border-line bg-card p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span
            aria-hidden="true"
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl"
            style={{ background: meta.color.bg, color: meta.color.fg }}
          >
            <Icon size={28} />
          </span>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>{status.label}</span>
              <span className="text-sm font-bold text-muted">{meta.label}</span>
            </div>
            <h1 className="text-2xl font-extrabold md:text-3xl">{event.title}</h1>
            {event.theme && (
              <p className="font-bold" style={{ color: meta.color.fg }}>
                Theme: {event.theme}
              </p>
            )}
            <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span className="inline-flex items-center gap-1">
                <CalendarDays aria-hidden="true" size={16} />
                <LocalTime iso={event.startsAt} />
              </span>
              <span className="inline-flex items-center gap-1">
                <MapPin aria-hidden="true" size={16} />
                {event.place}
              </span>
              <span>Hosted by {event.host ? event.host.display_name : "the community"}</span>
            </p>
          </div>
        </div>
        {event.description && <p className="max-w-prose whitespace-pre-line">{event.description}</p>}

        {/* RSVP + who's going */}
        <div className="flex flex-wrap items-center gap-3">
          {event.isMember && event.status !== "ended" && (
            <form action={toggleRsvp}>
              <input type="hidden" name="event_id" value={event.id} />
              <input type="hidden" name="going" value={String(event.imGoing)} />
              <SubmitButton variant={event.imGoing ? "secondary" : "primary"} pendingText="…">
                {event.imGoing ? "✓ You're going" : "I'm going"}
              </SubmitButton>
            </form>
          )}
          <div className="flex items-center gap-2 text-sm">
            <div className="flex -space-x-2">
              {event.going.slice(0, 8).map((p) => (
                <span key={p.userId} className="rounded-full ring-2 ring-card">
                  <Avatar path={p.avatar_path} name={p.display_name} size={28} />
                </span>
              ))}
            </div>
            <span className="inline-flex items-center gap-1 font-bold">
              <Users aria-hidden="true" size={16} />
              {event.going.length} going
            </span>
          </div>
        </div>

        {/* Host controls */}
        {event.canHost && event.status !== "ended" && <HostControls event={event} />}
        {event.isCreator && (
          <ActionButton
            action={deleteEvent}
            fields={{ event_id: event.id, slug: event.community.slug }}
            variant="ghost"
            className="text-danger hover:bg-danger-soft"
            pendingText="Deleting…"
            confirmText="Delete this event for everyone? This can't be undone."
          >
            Delete event
          </ActionButton>
        )}
      </header>

      {/* ---------- How it works ---------- */}
      <section aria-labelledby="how-heading" className="grid gap-4 rounded-3xl border border-line bg-card p-5 md:grid-cols-2">
        <div>
          <h2 id="how-heading" className="text-lg font-extrabold">
            How it works
          </h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
            {meta.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>
        {event.miniActivity && (
          <div className="rounded-2xl p-4" style={{ background: meta.color.bg }}>
            <p className="flex items-center gap-1.5 text-sm font-extrabold" style={{ color: meta.color.fg }}>
              <Sparkles aria-hidden="true" size={16} />
              Mini activity
            </p>
            <p className="mt-1 text-sm text-navy">{event.miniActivity}</p>
          </div>
        )}
      </section>

      {/* ---------- Take part ---------- */}
      {event.status !== "ended" &&
        (event.isMember ? (
          <TakePart event={event} myId={myId} myEntryCount={myEntries.length} />
        ) : (
          <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-accent-soft p-5">
            <p className="flex-1 text-sm">
              Join <strong>{event.community.name}</strong> to take part in this event.
            </p>
            <form action={joinCommunity}>
              <input type="hidden" name="community_id" value={event.community.id} />
              <input type="hidden" name="slug" value={event.community.slug} />
              <SubmitButton pendingText="Joining…">Join community</SubmitButton>
            </form>
          </div>
        ))}

      {/* ---------- Entries ---------- */}
      {event.type === "mystery_swap" ? (
        <MysteryPool event={event} myId={myId} />
      ) : event.type === "showcase_contest" ? (
        <ContestBoard event={event} myId={myId} />
      ) : event.type === "unboxing_party" ? (
        <UnboxingFeed event={event} myId={myId} />
      ) : (
        <ItemTable event={event} myId={myId} />
      )}
    </div>
  );
}

// ===========================================================================
function HostControls({ event }: { event: EventDetail }) {
  return (
    <div className="flex flex-wrap items-start gap-2 rounded-2xl bg-cream p-3">
      <p className="w-full text-xs font-bold uppercase tracking-wide text-muted">Host controls</p>
      {event.status === "upcoming" && (
        <ActionButton action={setEventStatus} fields={{ event_id: event.id, status: "live" }} pendingText="Starting…">
          Start event (go live)
        </ActionButton>
      )}
      {event.type === "mystery_swap" ? (
        <ActionButton
          action={revealMysterySwap}
          fields={{ event_id: event.id }}
          pendingText="Shuffling…"
          confirmText="Shuffle & reveal now? Every item in the pool goes to someone new, and the pool closes."
        >
          <Gift aria-hidden="true" size={18} />
          Shuffle &amp; reveal ({event.entries.length} items)
        </ActionButton>
      ) : (
        event.status === "live" && (
          <ActionButton
            action={setEventStatus}
            fields={{ event_id: event.id, status: "ended" }}
            variant="secondary"
            pendingText="Ending…"
            confirmText={event.type === "showcase_contest" ? "End the contest and crown the winner?" : "End this event?"}
          >
            {event.type === "showcase_contest" ? "End contest & crown winner" : "End event"}
          </ActionButton>
        )
      )}
    </div>
  );
}

// ===========================================================================
async function TakePart({ event, myId, myEntryCount }: { event: EventDetail; myId: string; myEntryCount: number }) {
  const meta = EVENT_TYPES[event.type];
  const onePerPerson = event.type === "mystery_swap" || event.type === "showcase_contest";
  if (onePerPerson && myEntryCount > 0) return null;
  if (!onePerPerson && myEntryCount >= 5) return null;

  let items: { id: string; title: string }[] = [];
  if (event.type === "showcase_contest") {
    // Any item you own can be entered in the contest.
    const supabase = await createClient();
    const { data } = await supabase
      .from("listings")
      .select("id, title")
      .eq("owner_id", myId)
      .neq("status", "traded")
      .order("created_at", { ascending: false });
    items = data ?? [];
  } else if (event.type !== "unboxing_party") {
    items = (await getTradeableItems(myId)).map((i) => ({ id: i.id, title: i.title }));
  }
  const entered = new Set(event.entries.map((e) => e.listing_id));
  items = items.filter((i) => !entered.has(i.id));

  return (
    <section aria-labelledby="take-part-heading" className="space-y-3 rounded-3xl border-2 border-accent bg-card p-5">
      <h2 id="take-part-heading" className="text-lg font-extrabold">
        {meta.addLabel}
      </h2>
      {event.type === "theme_day" && event.theme && (
        <p className="text-sm text-muted">Only add items that fit the theme: {event.theme}.</p>
      )}
      {event.type === "mystery_swap" && (
        <p className="text-sm text-muted">Your item stays locked (no other offers) until the reveal.</p>
      )}
      <AddEntryForm
        eventId={event.id}
        userId={myId}
        mode={event.type === "unboxing_party" ? "photo" : "listing"}
        items={items}
        submitLabel={meta.addLabel}
        emptyHint={
          event.type === "showcase_contest"
            ? "You don't have any items yet."
            : "You need an item that's up for trade and available."
        }
      />
    </section>
  );
}

function RemoveButton({ event, entryId }: { event: EventDetail; entryId: string }) {
  if (event.status === "ended") return null;
  return (
    <ActionButton
      action={removeEntry}
      fields={{ event_id: event.id, entry_id: entryId }}
      variant="ghost"
      className="!px-3 !py-1.5 text-xs"
      pendingText="…"
    >
      Remove
    </ActionButton>
  );
}

function EntryOwner({ owner }: { owner: { username: string; display_name: string; avatar_path: string | null } }) {
  return (
    <Link href={`/u/${owner.username}`} className="flex items-center gap-1.5 text-xs font-bold hover:underline">
      <Avatar path={owner.avatar_path} name={owner.display_name} size={20} />
      {owner.display_name}
    </Link>
  );
}

// ===========================================================================
// Mystery swap: the pool stays secret until the reveal.
function MysteryPool({ event, myId }: { event: EventDetail; myId: string }) {
  const revealed = event.status === "ended" && event.revealedAt;

  if (!revealed) {
    const mine = event.entries.find((e) => e.user_id === myId);
    return (
      <section aria-labelledby="pool-heading" className="space-y-4 rounded-3xl border border-line bg-card p-5">
        <h2 id="pool-heading" className="flex items-center gap-2 text-lg font-extrabold">
          <Gift aria-hidden="true" size={20} />
          The pool: {event.entries.length} {event.entries.length === 1 ? "item" : "items"}
        </h2>
        <p className="text-sm text-muted">The items stay secret until the host reveals them.</p>
        <div className="flex flex-wrap gap-2">
          {event.entries.map((entry) => (
            <span key={entry.id} className="inline-flex items-center gap-1.5 rounded-full bg-cream px-2.5 py-1 text-xs font-bold">
              <Avatar path={entry.owner.avatar_path} name={entry.owner.display_name} size={20} />
              {entry.owner.display_name}
            </span>
          ))}
        </div>
        {mine?.listing && (
          <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent-soft p-3 text-sm">
            <span>
              You put in <strong>{mine.listing.title}</strong>.
            </span>
            <RemoveButton event={event} entryId={mine.id} />
          </div>
        )}
      </section>
    );
  }

  const gotMine = event.entries.find((e) => e.receiver_id === myId);
  return (
    <section aria-labelledby="reveal-heading" className="space-y-4">
      <h2 id="reveal-heading" className="text-lg font-extrabold">
        The reveal
      </h2>
      {gotMine?.listing && (
        <div className="space-y-3 rounded-3xl border-2 border-accent bg-card p-5">
          <p className="text-lg font-extrabold">
            🎁 You got {gotMine.listing.title} from {gotMine.owner.display_name}!
          </p>
          {gotMine.caption && <p className="text-sm italic">Their note: &ldquo;{gotMine.caption}&rdquo;</p>}
          <ListingCard listing={gotMine.listing} />
        </div>
      )}
      <ul className="space-y-2">
        {event.entries.map((entry) => (
          <li key={entry.id} className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-card p-3 text-sm">
            <EntryOwner owner={entry.owner} />
            <span className="text-muted">gave</span>
            {entry.listing ? (
              <Link href={`/listings/${entry.listing.id}`} className="font-bold text-accent hover:underline">
                {entry.listing.title}
              </Link>
            ) : (
              <span className="text-muted">an item</span>
            )}
            <span className="text-muted">to</span>
            {entry.receiver ? <EntryOwner owner={entry.receiver} /> : <span className="text-muted">someone</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ===========================================================================
// Showcase contest: a leaderboard with one vote per person.
function ContestBoard({ event, myId }: { event: EventDetail; myId: string }) {
  const ranked = [...event.entries].sort((a, b) => b.votes - a.votes);
  const top = ranked[0]?.votes ?? 0;

  return (
    <section aria-labelledby="board-heading" className="space-y-3">
      <div>
        <h2 id="board-heading" className="text-lg font-extrabold">
          {event.status === "ended" ? "Final results" : "Leaderboard"}
        </h2>
        <p className="text-sm text-muted">
          {event.status === "upcoming"
            ? "Voting opens when the host starts the contest."
            : event.status === "live"
              ? "You have one vote. Tap another entry to move it."
              : "Voting is closed."}
        </p>
      </div>
      {ranked.length === 0 ? (
        <Notice tone="info">No entries yet. Be the first!</Notice>
      ) : (
        <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ranked.map((entry, index) => {
            const winner = event.status === "ended" && top > 0 && entry.votes === top;
            return (
              <li
                key={entry.id}
                className={`space-y-2 rounded-3xl border bg-card p-3 ${winner ? "border-[#f5b301] ring-2 ring-[#f5b301]" : "border-line"}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-muted">#{index + 1}</span>
                  {winner && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#fff4d6] px-2 py-0.5 text-xs font-extrabold text-[#8a5a00]">
                      <Crown aria-hidden="true" size={14} />
                      Winner
                    </span>
                  )}
                </div>
                {entry.listing && <ListingTile listing={entry.listing} />}
                {entry.caption && <p className="text-sm">{entry.caption}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <EntryOwner owner={entry.owner} />
                  {entry.user_id === myId ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">{entry.votes} votes</span>
                      <RemoveButton event={event} entryId={entry.id} />
                    </div>
                  ) : (
                    <VoteButton
                      eventId={event.id}
                      entryId={entry.id}
                      count={entry.votes}
                      voted={entry.iVoted}
                      kind="vote"
                      disabled={event.status !== "live"}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

// ===========================================================================
// Unboxing party: a photo feed with hearts.
function UnboxingFeed({ event, myId }: { event: EventDetail; myId: string }) {
  return (
    <section aria-labelledby="feed-heading" className="space-y-3">
      <h2 id="feed-heading" className="text-lg font-extrabold">
        Pulls ({event.entries.length})
      </h2>
      {event.entries.length === 0 ? (
        <Notice tone="info">No pulls posted yet. Open a box and post yours!</Notice>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[...event.entries].reverse().map((entry) => (
            <li key={entry.id} className="overflow-hidden rounded-3xl border border-line bg-card">
              {entry.photo_path && (
                <div className="relative aspect-square bg-accent-soft">
                  <Image
                    src={publicImageUrl("listing-images", entry.photo_path)}
                    alt={entry.caption ?? `${entry.owner.display_name}'s pull`}
                    fill
                    sizes="(min-width: 1024px) 320px, (min-width: 640px) 50vw, 100vw"
                    className="object-cover"
                  />
                </div>
              )}
              <div className="space-y-2 p-3">
                {entry.caption && <p className="text-sm">{entry.caption}</p>}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <EntryOwner owner={entry.owner} />
                  {entry.user_id === myId ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold">♥ {entry.votes}</span>
                      <RemoveButton event={event} entryId={entry.id} />
                    </div>
                  ) : (
                    <VoteButton eventId={event.id} entryId={entry.id} count={entry.votes} voted={entry.iVoted} kind="heart" disabled={event.status === "ended"} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ===========================================================================
// Swap meet / themed day: the shared table of items to trade.
function ItemTable({ event, myId }: { event: EventDetail; myId: string }) {
  const title = event.type === "theme_day" ? "The themed shelf" : "On the table";
  return (
    <section aria-labelledby="table-heading" className="space-y-3">
      <h2 id="table-heading" className="text-lg font-extrabold">
        {title} ({event.entries.length})
      </h2>
      {event.entries.length === 0 ? (
        <Notice tone="info">Nothing here yet. Add one of your tradeable items!</Notice>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {event.entries.map((entry) => {
            const canOffer =
              entry.user_id !== myId && entry.listing && entry.listing.status === "available" && entry.listing.for_trade;
            return (
              <li key={entry.id} className="space-y-2">
                {entry.listing && <ListingTile listing={entry.listing} />}
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <EntryOwner owner={entry.owner} />
                  {entry.user_id === myId ? (
                    <RemoveButton event={event} entryId={entry.id} />
                  ) : (
                    <VoteButton eventId={event.id} entryId={entry.id} count={entry.votes} voted={entry.iVoted} kind="heart" disabled={event.status === "ended"} />
                  )}
                </div>
                {canOffer && entry.listing && (
                  <Link href={`/listings/${entry.listing.id}/offer`} className={buttonClasses("primary", "w-full !py-2 text-xs")}>
                    Make an offer
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
