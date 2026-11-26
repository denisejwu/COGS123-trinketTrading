import Link from "next/link";
import { ArrowLeftRight, Eye, GraduationCap, MapPin, Package, Star, UserCheck, UserPlus, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { TraderBadge } from "@/components/TraderBadge";
import { ListingTile } from "@/components/listings/ListingTile";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClasses } from "@/components/ui/button";
import { timeAgo } from "@/lib/format";
import type { ListingCardData } from "@/lib/listings";
import { reviewTagLabel } from "@/lib/review-tags";
import type { SocialContext } from "@/lib/social";
import type { Profile } from "@/lib/types";
import { MessageButton } from "@/components/chat/MessageButton";
import { toggleFriend } from "./actions";

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

export type ProfileReview = {
  id: string;
  rating: number;
  tags: string[];
  comment: string | null;
  created_at: string;
  reviewer: { username: string; display_name: string; avatar_path: string | null };
};

/**
 * What a profile looks like. It only receives data and draws it; page.tsx
 * loads the data from Supabase.
 */
export function ProfileView({
  profile,
  isMe,
  activeTab,
  basePath,
  forTrade,
  showcase,
  reviews,
  social,
}: {
  profile: Profile;
  isMe: boolean;
  activeTab: ProfileTab;
  /** Where the tab links point, e.g. "/u/denise". */
  basePath: string;
  forTrade: ListingCardData[];
  showcase: ListingCardData[];
  reviews: ProfileReview[];
  social: SocialContext;
}) {
  const counts: Record<ProfileTab, number> = {
    "for-trade": forTrade.length,
    showcase: showcase.length,
    reviews: reviews.length,
  };

  return (
    <div className="space-y-8">
      {/* ---------- Header ---------- */}
      <section className="space-y-5 rounded-3xl border border-line bg-card p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar path={profile.avatar_path} name={profile.display_name} size={96} />
          <div className="min-w-0 flex-1 space-y-2">
            <div>
              <h1 className="text-2xl font-extrabold">{profile.display_name}</h1>
              <p className="text-muted">@{profile.username}</p>
            </div>
            <TraderBadge
              tradesCompleted={profile.trades_completed}
              ratingAvg={profile.rating_avg}
              ratingCount={profile.rating_count}
            />
            <div className="flex flex-wrap gap-2 text-sm">
              {profile.location && (
                <span className="inline-flex items-center gap-1 text-muted">
                  <MapPin aria-hidden="true" size={16} />
                  <span className="sr-only">School or city: </span>
                  {profile.location}
                </span>
              )}
              {social.sameSchool && (
                <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-bold text-success">
                  <GraduationCap aria-hidden="true" size={14} />
                  Same school as you
                </span>
              )}
            </div>
            {profile.bio && <p className="max-w-prose whitespace-pre-line">{profile.bio}</p>}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2 self-start">
            {isMe ? (
              <Link href="/settings" className={buttonClasses("secondary")}>
                Edit profile
              </Link>
            ) : (
              <>
              <MessageButton otherId={profile.id} />
              <form action={toggleFriend}>
                <input type="hidden" name="friend_id" value={profile.id} />
                <input type="hidden" name="username" value={profile.username} />
                <input type="hidden" name="is_friend" value={String(social.isFriend)} />
                <SubmitButton variant={social.isFriend ? "secondary" : "primary"} pendingText="…">
                  {social.isFriend ? <UserCheck aria-hidden="true" size={18} /> : <UserPlus aria-hidden="true" size={18} />}
                  {social.isFriend ? "Friends" : "Add friend"}
                </SubmitButton>
              </form>
              </>
            )}
          </div>
        </div>

        {/* ---------- Stats: trades, rating, friends ---------- */}
        <dl className="grid grid-cols-3 gap-2 text-center">
          <Stat icon={<ArrowLeftRight size={18} />} value={profile.trades_completed} label="Completed trades" />
          <Stat
            icon={<Star size={18} />}
            value={profile.rating_count > 0 && profile.rating_avg !== null ? Number(profile.rating_avg).toFixed(1) : "–"}
            label={profile.rating_count > 0 ? `Rating · ${profile.rating_count} ${profile.rating_count === 1 ? "review" : "reviews"}` : "No reviews yet"}
          />
          <Stat icon={<Users size={18} />} value={social.friendCount} label="Friends" />
        </dl>

        {/* ---------- Mutual friends ---------- */}
        {!isMe && social.mutualCount > 0 && (
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <div className="flex -space-x-2">
              {social.mutual.map((m) => (
                <span key={m.username} className="rounded-full ring-2 ring-card">
                  <Avatar path={m.avatar_path} name={m.display_name} size={28} />
                </span>
              ))}
            </div>
            <p>
              <strong>
                {social.mutualCount} mutual {social.mutualCount === 1 ? "friend" : "friends"}
              </strong>
              <span className="text-muted">
                {" "}
                · {social.mutual.map((m) => m.display_name).join(", ")}
                {social.mutualCount > social.mutual.length ? " and others" : ""}
              </span>
            </p>
          </div>
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
          <TileGrid
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
          <TileGrid
            listings={showcase}
            empty={
              <EmptyState icon={<Eye size={22} />} title="Showcase is empty">
                {isMe
                  ? "Items you get in swaps land here. You can also post a listing as “Showcase only”."
                  : `${profile.display_name} hasn't added anything to their showcase yet.`}
              </EmptyState>
            }
          />
        )}
        {activeTab === "reviews" &&
          (reviews.length === 0 ? (
            <EmptyState icon={<Star size={22} />} title="No reviews yet">
              Reviews appear here after a completed swap.
            </EmptyState>
          ) : (
            <ul className="space-y-3">
              {reviews.map((review) => (
                <li key={review.id} className="space-y-2 rounded-3xl border border-line bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/u/${review.reviewer.username}`} className="flex items-center gap-2 font-bold hover:underline">
                      <Avatar path={review.reviewer.avatar_path} name={review.reviewer.display_name} size={28} />
                      {review.reviewer.display_name}
                    </Link>
                    <Stars rating={review.rating} />
                    <span className="text-xs text-muted">{timeAgo(review.created_at)}</span>
                  </div>
                  {review.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {review.tags.map((tag) => (
                        <span key={tag} className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-accent">
                          {reviewTagLabel(tag)}
                        </span>
                      ))}
                    </div>
                  )}
                  {review.comment && <p className="whitespace-pre-line">{review.comment}</p>}
                </li>
              ))}
            </ul>
          ))}
      </section>
    </div>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: React.ReactNode; label: string }) {
  return (
    <div className="rounded-2xl bg-cream px-2 py-3">
      <dd className="flex items-center justify-center gap-1 text-xl font-extrabold">
        <span aria-hidden="true" className="text-accent">
          {icon}
        </span>
        {value}
      </dd>
      <dt className="text-xs text-muted">{label}</dt>
    </div>
  );
}

function TileGrid({ listings, empty }: { listings: ListingCardData[]; empty: React.ReactNode }) {
  if (listings.length === 0) return <>{empty}</>;
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingTile listing={listing} />
        </li>
      ))}
    </ul>
  );
}
