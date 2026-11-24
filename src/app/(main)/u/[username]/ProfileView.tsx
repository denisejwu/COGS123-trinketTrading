import Link from "next/link";
import { Eye, MapPin, Package, Star } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { TraderBadge } from "@/components/TraderBadge";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { buttonClasses } from "@/components/ui/button";
import type { ListingCardData } from "@/lib/listings";
import type { Profile } from "@/lib/types";

// The three profile tabs, with a short explanation shown under each.
export const PROFILE_TABS = {
  "for-trade": { label: "For trade", hint: "Items they're open to swapping." },
  showcase: { label: "Showcase", hint: "Items they're showing off, not trading." },
  reviews: { label: "Reviews", hint: "What other traders said after a swap." },
} as const;
export type ProfileTab = keyof typeof PROFILE_TABS;

/** Turns the ?tab= value from the URL into a valid tab (default: For trade). */
export function parseProfileTab(tab: unknown): ProfileTab {
  return typeof tab === "string" && tab in PROFILE_TABS ? (tab as ProfileTab) : "for-trade";
}

/**
 * What a profile looks like. It only receives data and draws it; page.tsx
 * is the part that loads the data from Supabase.
 */
export function ProfileView({
  profile,
  isMe,
  activeTab,
  basePath,
  forTrade,
  showcase,
}: {
  profile: Profile;
  isMe: boolean;
  activeTab: ProfileTab;
  /** Where the tab links point, e.g. "/u/denise". */
  basePath: string;
  forTrade: ListingCardData[];
  showcase: ListingCardData[];
}) {
  const counts: Partial<Record<ProfileTab, number>> = {
    "for-trade": forTrade.length,
    showcase: showcase.length,
  };

  return (
    <div className="space-y-8">
      {/* ---------- Header ---------- */}
      <section className="flex flex-col gap-5 rounded-3xl border border-line bg-card p-6 sm:flex-row sm:items-start">
        <Avatar path={profile.avatar_path} name={profile.display_name} size={96} />
        <div className="flex-1 space-y-2">
          <div>
            <h1 className="text-2xl font-extrabold">{profile.display_name}</h1>
            <p className="text-muted">@{profile.username}</p>
          </div>
          <TraderBadge
            tradesCompleted={profile.trades_completed}
            ratingAvg={profile.rating_avg}
            ratingCount={profile.rating_count}
            showHint
          />
          {profile.location && (
            <p className="flex items-center gap-1 text-sm text-muted">
              <MapPin aria-hidden="true" size={16} />
              <span className="sr-only">Location: </span>
              {profile.location}
            </p>
          )}
          {profile.bio && <p className="max-w-prose whitespace-pre-line">{profile.bio}</p>}
        </div>
        {isMe && (
          <Link href="/settings" className={buttonClasses("secondary", "self-start")}>
            Edit profile
          </Link>
        )}
      </section>

      {/* ---------- Tabs ---------- */}
      <section className="space-y-4">
        <div className="space-y-2">
          <LinkTabs
            label="Profile sections"
            active={activeTab}
            tabs={(Object.keys(PROFILE_TABS) as ProfileTab[]).map((key) => ({
              key,
              label: PROFILE_TABS[key].label,
              href: `${basePath}?tab=${key}`,
              count: counts[key],
            }))}
          />
          <p className="text-sm text-muted">{PROFILE_TABS[activeTab].hint}</p>
        </div>

        {activeTab === "for-trade" && (
          <ListingGrid
            listings={forTrade}
            empty={
              <EmptyState
                icon={<Package size={22} />}
                title="Nothing up for trade yet"
                action={
                  isMe ? (
                    <Link href="/listings/new" className={buttonClasses("primary")}>
                      Post a listing
                    </Link>
                  ) : undefined
                }
              >
                {isMe
                  ? "Post a listing and choose “Up for trade” to show it here."
                  : `${profile.display_name} hasn't listed anything for trade yet.`}
              </EmptyState>
            }
          />
        )}
        {activeTab === "showcase" && (
          <ListingGrid
            listings={showcase}
            empty={
              <EmptyState icon={<Eye size={22} />} title="Showcase is empty">
                {isMe
                  ? "Post a listing and choose “Showcase only” to show off items you're keeping."
                  : `${profile.display_name} hasn't added anything to their showcase yet.`}
              </EmptyState>
            }
          />
        )}
        {activeTab === "reviews" && (
          <EmptyState icon={<Star size={22} />} title="No reviews yet">
            Reviews appear here after a completed trade.
          </EmptyState>
        )}
      </section>
    </div>
  );
}
