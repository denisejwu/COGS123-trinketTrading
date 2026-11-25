import { requireProfile } from "@/lib/auth";
import { EVENT_SUMMARY_SELECT, sortEvents, type EventSummary } from "@/lib/events";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { HomeView, type ActiveSwap, type HomeCommunity, type TradeMatch } from "./HomeView";

/**
 * Home page: your active swaps, trade matches, communities, upcoming
 * events and recent listings. Loads the data, then draws HomeView.
 */
export default async function HomePage() {
  const profile = await requireProfile();
  const supabase = await createClient();

  const [{ data: memberships }, { data: matchRows }, { data: swapRows }] = await Promise.all([
    supabase
      .from("community_members")
      .select("community:communities ( id, slug, name, cover_path )")
      .eq("user_id", profile.id)
      .order("joined_at", { ascending: false }),
    supabase.rpc("get_trade_matches", { p_limit: 6 }),
    // Security rules only return swaps you're part of.
    supabase
      .from("trades")
      .select(
        `id, sender_id, sender_confirmed_at, recipient_confirmed_at,
         sender:profiles!trades_sender_id_fkey ( display_name, avatar_path ),
         recipient:profiles!trades_recipient_id_fkey ( display_name, avatar_path )`,
      )
      .eq("status", "planning")
      .order("created_at", { ascending: false })
      .limit(10),
  ]);
  const communities = (memberships ?? [])
    .map((m) => m.community)
    .filter(Boolean) as unknown as HomeCommunity[];
  const communityIds = communities.map((c) => c.id);

  type SwapRow = {
    id: string;
    sender_id: string;
    sender_confirmed_at: string | null;
    recipient_confirmed_at: string | null;
    sender: ActiveSwap["other"];
    recipient: ActiveSwap["other"];
  };
  const activeSwaps: ActiveSwap[] = ((swapRows ?? []) as unknown as SwapRow[]).map((row) => {
    const iAmSender = row.sender_id === profile.id;
    return {
      id: row.id,
      needsMe: !(iAmSender ? row.sender_confirmed_at : row.recipient_confirmed_at),
      other: iAmSender ? row.recipient : row.sender,
    };
  });

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
  if (communityIds.length > 0) query = query.in("community_id", communityIds);

  const rows = matchRows ?? [];
  const [{ data: listings }, { data: matchListings }, { data: eventRows }] = await Promise.all([
    query,
    rows.length
      ? supabase
          .from("listings")
          .select(LISTING_CARD_SELECT)
          .in("id", [...new Set(rows.flatMap((r) => [r.my_listing_id, r.their_listing_id]))])
      : Promise.resolve({ data: [] }),
    communityIds.length
      ? supabase
          .from("events")
          .select(EVENT_SUMMARY_SELECT)
          .in("community_id", communityIds)
          .neq("status", "ended")
          .order("starts_at", { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] }),
  ]);

  const byId = new Map(((matchListings ?? []) as unknown as ListingCardData[]).map((l) => [l.id, l]));
  const matches: TradeMatch[] = rows.flatMap((row) => {
    const mine = byId.get(row.my_listing_id);
    const theirs = byId.get(row.their_listing_id);
    if (!mine || !theirs) return [];
    return [{ kind: row.match_kind as TradeMatch["kind"], mine: { id: mine.id, title: mine.title }, theirs }];
  });

  // Haven't opened your starter pack yet? It opens into your newest
  // community, or Blind Boxes if you haven't joined any.
  let starterPack: { communityId: string; communityName: string } | null = null;
  if (!profile.starter_pack_claimed_at) {
    const target =
      communities[0] ??
      (await supabase.from("communities").select("id, name").eq("slug", "blind-boxes").maybeSingle()).data;
    if (target) starterPack = { communityId: target.id, communityName: target.name };
  }

  return (
    <HomeView
      starterPack={starterPack}
      displayName={profile.display_name}
      communities={communities}
      recentListings={(listings ?? []) as unknown as ListingCardData[]}
      listingsFromMyCommunities={communities.length > 0}
      matches={matches}
      activeSwaps={activeSwaps}
      events={sortEvents((eventRows ?? []) as unknown as EventSummary[])}
    />
  );
}
