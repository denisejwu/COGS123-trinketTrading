import Link from "next/link";
import { CalendarDays, Package, Sparkles, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { NextStepCard, type NextSteps } from "@/components/NextStepCard";
import { StarterPackCard } from "@/components/StarterPackCard";
import { RecentSwaps, type RecentSwap } from "@/components/trades/RecentSwaps";
import { CommunityCover } from "@/components/communities/CommunityCover";
import { EventCard } from "@/components/events/EventCard";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/button";
import type { EventSummary } from "@/lib/events";
import type { ListingCardData } from "@/lib/listings";

/** A swap that's been agreed but not yet confirmed by both people. */
export type ActiveSwap = {
  id: string;
  needsMe: boolean;
  other: { display_name: string; avatar_path: string | null };
};

export type HomeCommunity = { id: string; slug: string; name: string; cover_path: string | null };

/** A suggested trade, found from "Looking for" notes. */
export type TradeMatch = {
  kind: "perfect" | "they_have" | "you_have";
  mine: { id: string; title: string };
  theirs: ListingCardData;
};

function matchExplanation(match: TradeMatch) {
  const name = match.theirs.owner.display_name;
  if (match.kind === "perfect") {
    return `${name} has something you're looking for, and is looking for your “${match.mine.title}”.`;
  }
  if (match.kind === "they_have") {
    return `Matches what you're looking for on your “${match.mine.title}” listing.`;
  }
  return `${name} is looking for something like your “${match.mine.title}”.`;
}

/**
 * What the home page looks like: your next step, active swaps, trade
 * matches, recent swaps, communities, recent listings and events.
 */
export function HomeView({
  displayName,
  communities,
  recentListings,
  listingsFromMyCommunities,
  matches,
  activeSwaps,
  events,
  starterPack,
  nextSteps,
  recentSwaps,
}: {
  displayName: string;
  communities: HomeCommunity[];
  recentListings: ListingCardData[];
  /** True when the listings come from your communities (vs. everywhere). */
  listingsFromMyCommunities: boolean;
  matches: TradeMatch[];
  activeSwaps: ActiveSwap[];
  events: EventSummary[];
  /** Set when you haven't opened your starter pack yet. */
  starterPack?: { communityId: string; communityName: string } | null;
  /** The guide card (once your pack is open). */
  nextSteps?: NextSteps | null;
  /** Trades that already happened, as examples. */
  recentSwaps?: RecentSwap[];
}) {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-extrabold md:text-3xl">Hi, {displayName}!</h1>
        <p className="text-muted">Here&apos;s what&apos;s happening in your collector world.</p>
      </section>

      {starterPack && <StarterPackCard communityId={starterPack.communityId} communityName={starterPack.communityName} />}

      {nextSteps && <NextStepCard steps={nextSteps} />}

      {activeSwaps.length > 0 && (
        <section aria-labelledby="your-swaps" className="space-y-3">
          <h2 id="your-swaps" className="text-lg font-extrabold">
            Your swaps
          </h2>
          <ul className="space-y-2">
            {activeSwaps.map((swap) => (
              <li key={swap.id}>
                <Link
                  href={`/trades/${swap.id}`}
                  className="flex items-center gap-3 rounded-3xl border border-accent bg-card p-4 hover:shadow-md"
                >
                  <Avatar path={swap.other.avatar_path} name={swap.other.display_name} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="block font-extrabold">Swap with {swap.other.display_name}</span>
                    <span className="block text-xs text-muted">
                      {swap.needsMe ? "Waiting for you to confirm" : "Waiting for them to confirm"}
                    </span>
                  </span>
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-white">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="matches" className="space-y-3">
        <div>
          <h2 id="matches" className="flex items-center gap-1.5 text-lg font-extrabold">
            <Sparkles aria-hidden="true" size={20} className="text-accent" />
            Trade matches
          </h2>
          <p className="text-sm text-muted">
            Found using the &ldquo;Looking for&rdquo; notes on your listings and other people&apos;s.
          </p>
        </div>
        {matches.length === 0 ? (
          <p className="rounded-3xl border border-dashed border-line p-4 text-sm text-muted">
            No matches yet. Add a &ldquo;Looking for&rdquo; note to your listings (e.g. &ldquo;any Miku&rdquo;) and
            we&apos;ll point out people who have it.
          </p>
        ) : (
          <ul className="grid gap-4 md:grid-cols-2">
            {matches.map((match) => (
              <li key={`${match.mine.id}-${match.theirs.id}`} className="space-y-3 rounded-3xl border border-line bg-card p-4">
                <div className="space-y-1">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-extrabold ${
                      match.kind === "perfect" ? "bg-accent text-white" : "bg-accent-soft text-accent"
                    }`}
                  >
                    {match.kind === "perfect"
                      ? "Perfect match"
                      : match.kind === "they_have"
                        ? "They have what you want"
                        : "They want what you have"}
                  </span>
                  <p className="text-sm">{matchExplanation(match)}</p>
                </div>
                <ListingCard listing={match.theirs} />
                <Link
                  href={`/listings/${match.theirs.id}/offer?give=${match.mine.id}`}
                  className={buttonClasses("primary", "w-full")}
                >
                  Offer your {match.mine.title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <RecentSwaps swaps={recentSwaps ?? []} title="Recent swaps: see how others traded" />

      <section aria-labelledby="my-communities" className="space-y-3">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="my-communities" className="text-lg font-extrabold">
            Your communities
          </h2>
          {communities.length > 0 && (
            <Link href="/communities" className="text-sm font-bold text-accent hover:underline">
              Browse all
            </Link>
          )}
        </div>
        {communities.length === 0 ? (
          <EmptyState
            icon={<Users size={22} />}
            title="You haven't joined any communities yet"
            action={
              <Link href="/communities" className={buttonClasses("primary")}>
                Browse communities
              </Link>
            }
          >
            Communities are groups for each kind of collectible, like Blind Boxes or Enamel Pins.
          </EmptyState>
        ) : (
          <ul className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-2">
            {communities.map((c) => (
              <li key={c.id} className="shrink-0">
                <Link
                  href={`/c/${c.slug}`}
                  className="flex w-36 flex-col overflow-hidden rounded-2xl border border-line bg-card hover:shadow-md"
                >
                  <CommunityCover slug={c.slug} coverPath={c.cover_path} className="h-16" iconSize={28} />
                  <span className="truncate px-3 py-2 text-sm font-bold">{c.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="recent-listings" className="space-y-3">
        <div>
          <h2 id="recent-listings" className="text-lg font-extrabold">
            Recent listings
          </h2>
          <p className="text-sm text-muted">
            {listingsFromMyCommunities ? "New in your communities." : "New across PopSwap. Join communities to personalise this."}
          </p>
        </div>
        <ListingGrid
          listings={recentListings}
          showCommunity
          empty={
            <EmptyState
              icon={<Package size={22} />}
              title="No listings yet"
              action={
                <Link href="/listings/new" className={buttonClasses("primary")}>
                  Post a listing
                </Link>
              }
            >
              Be the first to post one!
            </EmptyState>
          }
        />
      </section>

      <section aria-labelledby="upcoming-events" className="space-y-3">
        <h2 id="upcoming-events" className="text-lg font-extrabold">
          Upcoming events
        </h2>
        {events.length === 0 ? (
          <EmptyState icon={<CalendarDays size={22} />} title="No upcoming events">
            Swap meets, mystery swaps and unboxing parties from your communities will appear here.
          </EmptyState>
        ) : (
          <ul className="grid gap-3 md:grid-cols-2">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} showCommunity />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
