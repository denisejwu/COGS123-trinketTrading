import "server-only";
import { coverPhoto } from "@/lib/listings";
import { effectiveRarity, itemPoints } from "@/lib/fairness";
import { createClient } from "@/lib/supabase/server";
import type {
  ListingCondition,
  ListingRarity,
  ListingStatus,
  MessageKind,
  OfferStatus,
  PersonSummary,
  TradeStatus,
} from "@/lib/types";

/** An item as shown in a proposal, with its fairness points worked out. */
export type ProposalItem = {
  id: string;
  title: string;
  coverPath: string | null;
  condition: ListingCondition;
  rarity: ListingRarity;
  /** True when the rarity comes from community votes, not the owner. */
  rarityFromCommunity: boolean;
  points: number;
  ownerId: string;
  status: ListingStatus;
  forTrade: boolean;
};

export type ChatMessage = {
  id: string;
  offer_id: string;
  sender_id: string | null;
  kind: MessageKind;
  body: string;
  round_id: string | null;
  created_at: string;
};

/** Columns needed to turn a listing into a ProposalItem. */
export const PROPOSAL_LISTING_SELECT =
  "id, title, condition, rarity, status, for_trade, owner_id, listing_images ( path, position ), listing_rarity_votes ( rarity )";

type ListingRow = {
  id: string;
  title: string;
  condition: ListingCondition;
  rarity: ListingRarity;
  status: ListingStatus;
  for_trade: boolean;
  owner_id: string;
  listing_images: { path: string; position: number }[];
  listing_rarity_votes: { rarity: ListingRarity }[];
};

export function toProposalItem(row: ListingRow): ProposalItem {
  const rarity = effectiveRarity(row.rarity, row.listing_rarity_votes ?? []);
  return {
    id: row.id,
    title: row.title,
    coverPath: coverPhoto(row.listing_images ?? []),
    condition: row.condition,
    rarity: rarity.rarity,
    rarityFromCommunity: rarity.source === "community",
    points: itemPoints(rarity.rarity, row.condition),
    ownerId: row.owner_id,
    status: row.status,
    forTrade: row.for_trade,
  };
}

/** Someone's listings that could go into a trade right now. */
export async function getTradeableItems(ownerId: string): Promise<ProposalItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("listings")
    .select(PROPOSAL_LISTING_SELECT)
    .eq("owner_id", ownerId)
    .eq("status", "available")
    .eq("for_trade", true)
    .order("created_at", { ascending: false })
    .limit(60);
  if (error) throw new Error(`Couldn't load listings: ${error.message}`);
  return ((data ?? []) as unknown as ListingRow[]).map(toProposalItem);
}

const PERSON = "id, username, display_name, avatar_path, trades_completed, rating_avg, rating_count, is_demo, trader_level";

/**
 * Everything the negotiation room needs. Returns null if the offer doesn't
 * exist or you're not one of the two people in it (security rules hide it).
 */
export async function getNegotiation(offerId: string, myId: string) {
  const supabase = await createClient();

  const { data: offer } = await supabase
    .from("offers")
    .select(
      `id, status, listing_id, sender_id, recipient_id, current_round_id, closed_reason, created_at,
       sender:profiles!offers_sender_id_fkey ( ${PERSON} ),
       recipient:profiles!offers_recipient_id_fkey ( ${PERSON} ),
       trade:trades ( id, status )`,
    )
    .eq("id", offerId)
    .maybeSingle();
  if (!offer) return null;

  const [{ data: roundRows }, { data: messageRows }] = await Promise.all([
    supabase
      .from("offer_rounds")
      .select(`id, round_no, proposed_by, created_at, offer_items ( listing_id, giver_id, listing:listings ( ${PROPOSAL_LISTING_SELECT} ) )`)
      .eq("offer_id", offerId)
      .order("round_no", { ascending: true }),
    supabase
      .from("trade_messages")
      .select("id, offer_id, sender_id, kind, body, round_id, created_at")
      .eq("offer_id", offerId)
      .order("created_at", { ascending: true })
      .limit(500),
  ]);

  const rounds = ((roundRows ?? []) as unknown as {
    id: string;
    round_no: number;
    proposed_by: string;
    created_at: string;
    offer_items: { listing_id: string; giver_id: string; listing: ListingRow | null }[];
  }[]).map((round) => ({
    id: round.id,
    roundNo: round.round_no,
    proposedBy: round.proposed_by,
    createdAt: round.created_at,
    items: round.offer_items
      .filter((i) => i.listing)
      // giverId = whose side the item was on when proposed.
      .map((i) => ({ ...toProposalItem(i.listing as ListingRow), giverId: i.giver_id })),
  }));

  const sender = offer.sender as unknown as PersonSummary;
  const recipient = offer.recipient as unknown as PersonSummary;
  const iAmSender = offer.sender_id === myId;

  return {
    id: offer.id,
    status: offer.status as OfferStatus,
    listingId: offer.listing_id,
    closedReason: offer.closed_reason,
    createdAt: offer.created_at,
    iAmSender,
    me: iAmSender ? sender : recipient,
    other: iAmSender ? recipient : sender,
    rounds,
    currentRound: rounds.find((r) => r.id === offer.current_round_id) ?? rounds.at(-1) ?? null,
    messages: (messageRows ?? []) as ChatMessage[],
    trade: (offer.trade as unknown as { id: string; status: TradeStatus } | null) ?? null,
  };
}

export type Negotiation = NonNullable<Awaited<ReturnType<typeof getNegotiation>>>;
