import type { ListingCondition } from "@/lib/types";

/**
 * Condition options, in order, with a plain-language hint for each so
 * people pick the same word for the same thing.
 */
export const CONDITIONS: { value: ListingCondition; label: string; hint: string }[] = [
  { value: "sealed", label: "Sealed", hint: "Never opened, still in the original packaging" },
  { value: "like_new", label: "Like new", hint: "Opened, but looks untouched" },
  { value: "gently_used", label: "Gently used", hint: "Small signs of use, no real damage" },
  { value: "well_loved", label: "Well loved", hint: "Clear wear or flaws, still cute" },
];

export function conditionLabel(value: ListingCondition) {
  return CONDITIONS.find((c) => c.value === value)?.label ?? value;
}

export function isCondition(value: unknown): value is ListingCondition {
  return CONDITIONS.some((c) => c.value === value);
}

/**
 * The columns a listing card needs, including its photos, owner (for the
 * "Posted by" line + trader badge) and community. The `!..._fkey` parts
 * tell Supabase which relationship to follow.
 */
export const LISTING_CARD_SELECT = `
  id, title, description, condition, status, for_trade, looking_for, created_at,
  listing_images ( path, position ),
  owner:profiles!listings_owner_id_fkey (
    id, username, display_name, avatar_path, trades_completed, rating_avg, rating_count, location
  ),
  community:communities!listings_community_id_fkey ( slug, name )
` as const;

/** Same as above, but only keeps listings whose owner matches an owner filter (used for "Nearby"). */
export const LISTING_CARD_SELECT_OWNER_FILTER = LISTING_CARD_SELECT.replace(
  "owner:profiles!listings_owner_id_fkey (",
  "owner:profiles!listings_owner_id_fkey!inner (",
) as typeof LISTING_CARD_SELECT;

export type ListingCardData = {
  id: string;
  title: string;
  description: string;
  condition: ListingCondition;
  status: "available" | "pending" | "traded";
  for_trade: boolean;
  looking_for: string | null;
  created_at: string;
  listing_images: { path: string; position: number }[];
  owner: {
    id: string;
    username: string;
    display_name: string;
    avatar_path: string | null;
    trades_completed: number;
    rating_avg: number | null;
    rating_count: number;
    location: string | null;
  };
  community: { slug: string; name: string };
};

/** The cover photo path (position 0), or the first photo we have. */
export function coverPhoto(images: { path: string; position: number }[]) {
  return [...images].sort((a, b) => a.position - b.position)[0]?.path ?? null;
}

/**
 * Makes user text safe to use inside a SQL `ilike` pattern, so typing
 * "%" or "_" doesn't act as a wildcard.
 */
export function escapeLike(text: string) {
  return text.replace(/[\\%_*]/g, (ch) => `\\${ch}`);
}

export const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
