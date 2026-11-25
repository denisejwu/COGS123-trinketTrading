import "server-only";
import { getNegotiation } from "@/lib/negotiations";
import { createClient } from "@/lib/supabase/server";
import type { TradeStatus } from "@/lib/types";

/**
 * Everything the swap room needs: the agreed deal, who has confirmed,
 * proof photos (with temporary private links), reviews and the chat.
 * Returns null if the trade doesn't exist or isn't yours.
 */
export async function getSwap(tradeId: string, myId: string) {
  const supabase = await createClient();
  const { data: trade } = await supabase
    .from("trades")
    .select(
      "id, offer_id, round_id, status, sender_id, recipient_id, sender_confirmed_at, recipient_confirmed_at, completed_at, cancelled_at, cancelled_by, created_at",
    )
    .eq("id", tradeId)
    .maybeSingle();
  if (!trade) return null;

  const negotiation = await getNegotiation(trade.offer_id, myId);
  if (!negotiation) return null;

  const [{ data: photoRows }, { data: reviewRows }] = await Promise.all([
    supabase
      .from("trade_photos")
      .select("id, uploader_id, path, caption, created_at")
      .eq("trade_id", tradeId)
      .order("created_at", { ascending: true }),
    supabase
      .from("reviews")
      .select("id, reviewer_id, reviewee_id, rating, tags, comment, created_at")
      .eq("trade_id", tradeId),
  ]);

  // Proof photos are in a PRIVATE bucket, so we make short-lived links.
  const paths = (photoRows ?? []).map((p) => p.path);
  const { data: signed } = paths.length
    ? await supabase.storage.from("trade-photos").createSignedUrls(paths, 60 * 60)
    : { data: [] };
  const urlFor = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  const iAmSender = trade.sender_id === myId;
  const round = negotiation.rounds.find((r) => r.id === trade.round_id) ?? negotiation.currentRound;

  return {
    id: trade.id,
    offerId: trade.offer_id,
    status: trade.status as TradeStatus,
    createdAt: trade.created_at,
    completedAt: trade.completed_at,
    cancelledBy: trade.cancelled_by,
    me: negotiation.me,
    other: negotiation.other,
    iConfirmed: Boolean(iAmSender ? trade.sender_confirmed_at : trade.recipient_confirmed_at),
    theyConfirmed: Boolean(iAmSender ? trade.recipient_confirmed_at : trade.sender_confirmed_at),
    giving: round?.items.filter((i) => i.giverId === myId) ?? [],
    getting: round?.items.filter((i) => i.giverId !== myId) ?? [],
    photos: (photoRows ?? []).map((p) => ({ ...p, url: urlFor.get(p.path) ?? null })),
    myReview: reviewRows?.find((r) => r.reviewer_id === myId) ?? null,
    theirReview: reviewRows?.find((r) => r.reviewer_id !== myId) ?? null,
    messages: negotiation.messages,
  };
}

export type Swap = NonNullable<Awaited<ReturnType<typeof getSwap>>>;
