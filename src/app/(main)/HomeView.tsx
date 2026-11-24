import Link from "next/link";
import { CalendarDays, Package, Users } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/button";

/**
 * What the home page looks like. In later phases these sections fill up
 * with your communities, recent listings, upcoming events and active trades.
 */
export function HomeView({ displayName }: { displayName: string }) {
  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-extrabold md:text-3xl">Hi, {displayName}!</h1>
        <p className="text-muted">Here&apos;s what&apos;s happening in your collector world.</p>
      </section>

      <section aria-labelledby="my-communities" className="space-y-3">
        <h2 id="my-communities" className="text-lg font-extrabold">
          Your communities
        </h2>
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
      </section>

      <section aria-labelledby="recent-listings" className="space-y-3">
        <h2 id="recent-listings" className="text-lg font-extrabold">
          Recent listings
        </h2>
        <EmptyState icon={<Package size={22} />} title="No listings yet">
          Be the first to post one. Listings from your communities will show up here.
        </EmptyState>
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
