import { requireProfile } from "@/lib/auth";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { HomeView, type HomeCommunity, type TradeMatch } from "./HomeView";

/** Home page: loads your communities, matches and recent listings, then draws HomeView. */
export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: memberships }, { data: matchRows }] = await Promise.all([
    supabase
      .from("community_members")
      .select("community:communities ( id, slug, name, cover_path )")
      .eq("user_id", profile.id)
      .order("joined_at", { ascending: false }),
    supabase.rpc("get_trade_matches", { p_limit: 6 }),
  ]);
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

  // Load the listings that the matches point to.
  const rows = matchRows ?? [];
  const [{ data: listings }, { data: matchListings }] = await Promise.all([
    query,
    rows.length
      ? supabase
          .from("listings")
          .select(LISTING_CARD_SELECT)
          .in("id", [...new Set(rows.flatMap((r) => [r.my_listing_id, r.their_listing_id]))])
      : Promise.resolve({ data: [] }),
  ]);
  const byId = new Map(((matchListings ?? []) as unknown as ListingCardData[]).map((l) => [l.id, l]));
  const matches: TradeMatch[] = rows.flatMap((row) => {
    const mine = byId.get(row.my_listing_id);
    const theirs = byId.get(row.their_listing_id);
    if (!mine || !theirs) return [];
    return [{ kind: row.match_kind as TradeMatch["kind"], mine: { id: mine.id, title: mine.title }, theirs }];
  });

  return (
    <HomeView
      displayName={profile.display_name}
      communities={communities}
      recentListings={(listings ?? []) as unknown as ListingCardData[]}
      listingsFromMyCommunities={communities.length > 0}
      matches={matches}
    />
  );
}
