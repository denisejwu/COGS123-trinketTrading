import type { Metadata } from "next";
import Link from "next/link";
import { Inbox, Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { OfferStatusChip } from "@/components/trades/OfferStatusChip";
import { TradesTabs } from "@/components/trades/TradesTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { requireUserId } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { OfferStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Offers" };

type Row = {
  id: string;
  status: OfferStatus;
  updated_at: string;
  sender_id: string;
  recipient_id: string;
  listing: { id: string; title: string } | null;
  sender: { username: string; display_name: string; avatar_path: string | null };
  recipient: { username: string; display_name: string; avatar_path: string | null };
  current_round: { proposed_by: string; round_no: number } | null;
};

const TABS = {
  received: { label: "Received", hint: "Offers other collectors sent you." },
  sent: { label: "Sent", hint: "Offers you made on other people's items." },
} as const;

export default async function OffersPage({ searchParams }: PageProps<"/offers">) {
  const { tab } = await searchParams;
  const active = tab === "sent" ? "sent" : "received";

  const myId = await requireUserId();
  const supabase = await createClient();
  // Security rules only return negotiations you're part of.
  const { data, error } = await supabase
    .from("offers")
    .select(
      `id, status, updated_at, sender_id, recipient_id,
       listing:listings!offers_listing_id_fkey ( id, title ),
       sender:profiles!offers_sender_id_fkey ( username, display_name, avatar_path ),
       recipient:profiles!offers_recipient_id_fkey ( username, display_name, avatar_path ),
       current_round:offer_rounds!offers_current_round_id_fkey ( proposed_by, round_no )`,
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Couldn't load offers: ${error.message}`);

  const rows = (data ?? []) as unknown as Row[];
  const yourMove = (r: Row) => r.status === "pending" && r.current_round?.proposed_by !== myId;
  const received = rows.filter((r) => r.recipient_id === myId);
  const sent = rows.filter((r) => r.sender_id === myId);
  // Your turn first, then other open ones, then closed.
  const rank = (r: Row) => (yourMove(r) ? 0 : r.status === "pending" ? 1 : 2);
  const shown = (active === "received" ? received : sent).sort((a, b) => rank(a) - rank(b));

  const count = (list: Row[]) => list.filter(yourMove).length;

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">Trades</h1>
        <TradesTabs active="offers" />
      </div>

      <div className="space-y-2">
        <LinkTabs
          label="Offer lists"
          active={active}
          tabs={[
            { key: "received", label: TABS.received.label, href: "/offers?tab=received", count: count(received) || undefined },
            { key: "sent", label: TABS.sent.label, href: "/offers?tab=sent", count: count(sent) || undefined },
          ]}
        />
        <p className="text-sm text-muted">
          {TABS[active].hint} The number shows how many are waiting on you.
        </p>
      </div>

      {shown.length === 0 ? (
        <EmptyState
          icon={active === "received" ? <Inbox size={22} /> : <Send size={22} />}
          title={active === "received" ? "No offers yet" : "You haven't made any offers"}
          action={
            <Link href="/communities" className="font-bold text-accent hover:underline">
              Browse communities
            </Link>
          }
        >
          {active === "received"
            ? "When someone wants to trade for one of your items, it shows up here."
            : "Find something you love and tap “Make an offer”."}
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {shown.map((row) => {
            const other = row.sender_id === myId ? row.recipient : row.sender;
            return (
              <li key={row.id}>
                <Link
                  href={`/offers/${row.id}`}
                  className={`flex items-center gap-3 rounded-3xl border bg-card p-4 hover:shadow-md ${
                    yourMove(row) ? "border-accent" : "border-line"
                  }`}
                >
                  <Avatar path={other.avatar_path} name={other.display_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-extrabold">
                      {other.display_name}
                      <span className="font-normal text-muted"> · {row.listing?.title ?? "a removed item"}</span>
                    </p>
                    <p className="text-xs text-muted">
                      {row.current_round && row.current_round.round_no > 1
                        ? `${row.current_round.round_no} proposals so far · `
                        : ""}
                      updated {timeAgo(row.updated_at)}
                    </p>
                  </div>
                  <OfferStatusChip status={row.status} yourMove={yourMove(row)} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
