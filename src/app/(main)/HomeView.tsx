import Link from "next/link";
import { CalendarDays, Package, Sparkles, Users } from "lucide-react";
import { CommunityCover } from "@/components/communities/CommunityCover";
import { ListingCard } from "@/components/listings/ListingCard";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/button";
import type { ListingCardData } from "@/lib/listings";

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
 * What the home page looks like: your communities, recent listings, and
 * (in later phases) upcoming events and your active trades.
 */
export function HomeView({
  displayName,
  communities,
  recentListings,
  listingsFromMyCommunities,
  matches,
}: {
  displayName: string;
  communities: HomeCommunity[];
  recentListings: ListingCardData[];
  /** True when the listings come from your communities (vs. everywhere). */
  listingsFromMyCommunities: boolean;
  matches: TradeMatch[];
}) {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-extrabold md:text-3xl">Hi, {displayName}!</h1>
        <p className="text-muted">Here&apos;s what&apos;s happening in your collector world.</p>
      </section>

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
        <EmptyState icon={<CalendarDays size={22} />} title="No upcoming events">
          Swap meets and unboxing parties from your communities will appear here.
        </EmptyState>
      </section>
    </div>
  );
}
