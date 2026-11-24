import { requireProfile } from "@/lib/auth";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { HomeView, type HomeCommunity } from "./HomeView";

/** Home page: loads your communities and recent listings, then draws HomeView. */
export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const { data: memberships } = await supabase
    .from("community_members")
    .select("community:communities ( id, slug, name, cover_path )")
    .eq("user_id", profile.id)
    .order("joined_at", { ascending: false });
  const communities = (memberships ?? [])
    .map((m) => m.community)
    .filter(Boolean) as unknown as HomeCommunity[];

  // Recent tradeable listings from your communities (or from everywhere
  // if you haven't joined any yet), not including your own.
  let query = supabase
    .from("listings")
    .select(LISTING_CARD_SELECT)
    .eq("status", "available")
    .eq("for_trade", true)
    .neq("owner_id", profile.id)
    .order("created_at", { ascending: false })
    .limit(6);
  if (communities.length > 0) query = query.in("community_id", communities.map((c) => c.id));
  const { data: listings } = await query;

  return (
    <HomeView
      displayName={profile.display_name}
      communities={communities}
      recentListings={(listings ?? []) as unknown as ListingCardData[]}
      listingsFromMyCommunities={communities.length > 0}
    />
  );
}
