import Link from "next/link";
import { CalendarDays, Package, Users } from "lucide-react";
import { CommunityCover } from "@/components/communities/CommunityCover";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/button";
import type { ListingCardData } from "@/lib/listings";

export type HomeCommunity = { id: string; slug: string; name: string; cover_path: string | null };

/**
 * What the home page looks like: your communities, recent listings, and
 * (in later phases) upcoming events and your active trades.
 */
export function HomeView({
  displayName,
  communities,
  recentListings,
  listingsFromMyCommunities,
}: {
  displayName: string;
  communities: HomeCommunity[];
  recentListings: ListingCardData[];
  /** True when the listings come from your communities (vs. everywhere). */
  listingsFromMyCommunities: boolean;
}) {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-extrabold md:text-3xl">Hi, {displayName}!</h1>
        <p className="text-muted">Here&apos;s what&apos;s happening in your collector world.</p>
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
