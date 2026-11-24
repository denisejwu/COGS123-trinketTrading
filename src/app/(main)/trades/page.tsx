import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { TradesTabs } from "@/components/trades/TradesTabs";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireUserId } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import type { TradeStatus } from "@/lib/types";

export const metadata: Metadata = { title: "Swaps" };

type Row = {
  id: string;
  status: TradeStatus;
  created_at: string;
  sender_id: string;
  sender: { display_name: string; avatar_path: string | null };
  recipient: { display_name: string; avatar_path: string | null };
};

const STATUS: Record<TradeStatus, { label: string; className: string }> = {
  planning: { label: "Getting ready to swap", className: "bg-warning-soft text-navy" },
  completed: { label: "Swapped", className: "bg-success-soft text-success" },
  cancelled: { label: "Cancelled", className: "bg-cream text-muted" },
};

/** Accepted deals ("swaps"). Negotiations live on the Offers tab. */
export default async function TradesPage() {
  const myId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("trades")
    .select(
      `id, status, created_at, sender_id,
       sender:profiles!trades_sender_id_fkey ( display_name, avatar_path ),
       recipient:profiles!trades_recipient_id_fkey ( display_name, avatar_path )`,
    )
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw new Error(`Couldn't load swaps: ${error.message}`);
  const rows = (data ?? []) as unknown as Row[];

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h1 className="text-2xl font-extrabold md:text-3xl">Trades</h1>
        <TradesTabs active="trades" />
        <p className="text-sm text-muted">Deals you&apos;ve agreed on. Confirm the swap in each swap room.</p>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<ArrowLeftRight size={22} />}
          title="No swaps yet"
          action={
            <Link href="/offers" className="font-bold text-accent hover:underline">
              See your offers
            </Link>
          }
        >
          When you and another collector accept a deal, it shows up here.
        </EmptyState>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => {
            const other = row.sender_id === myId ? row.recipient : row.sender;
            const status = STATUS[row.status];
            return (
              <li key={row.id}>
                <Link
                  href={`/trades/${row.id}`}
                  className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4 hover:shadow-md"
                >
                  <Avatar path={other.avatar_path} name={other.display_name} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold">Swap with {other.display_name}</p>
                    <p className="text-xs text-muted">Agreed {timeAgo(row.created_at)}</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${status.className}`}>
                    {status.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
