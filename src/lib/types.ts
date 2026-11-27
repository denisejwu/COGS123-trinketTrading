/**
 * Friendly names for database rows, used around the app.
 * (database.types.ts is generated; this file is written by hand.)
 */
import type { Enums, Tables } from "./database.types";

export type Profile = Tables<"profiles">;
export type Community = Tables<"communities">;
export type Listing = Tables<"listings">;
export type ListingImage = Tables<"listing_images">;
export type ListingComment = Tables<"listing_comments">;
export type CommunityPost = Tables<"community_posts">;
export type Offer = Tables<"offers">;
export type OfferRound = Tables<"offer_rounds">;
export type TradeMessage = Tables<"trade_messages">;
export type Trade = Tables<"trades">;

export type ListingCondition = Enums<"listing_condition">;
export type ListingStatus = Enums<"listing_status">;
export type ListingRarity = Enums<"listing_rarity">;
export type OfferStatus = Enums<"offer_status">;
export type TradeStatus = Enums<"trade_status">;
export type MessageKind = Enums<"message_kind">;

/** The public bits of a profile we show next to names. */
export type PersonSummary = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  trades_completed: number;
  rating_avg: number | null;
  rating_count: number;
  /** A practice trader (demo account) who replies instantly. */
  is_demo?: boolean;
  /** "new" or "experienced" (picked when the starter pack is opened). */
  trader_level?: string;
};
