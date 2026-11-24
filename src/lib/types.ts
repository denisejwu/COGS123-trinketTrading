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

export type ListingCondition = Enums<"listing_condition">;
export type ListingStatus = Enums<"listing_status">;
