import Link from "next/link";
import { Route } from "lucide-react";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Step = {
  id: string;
  created_at: string;
  trade_id: string | null;
  from: { username: string; display_name: string } | null;
  to: { username: string; display_name: string } | null;
  event: { id: string; title: string } | null;
};

/**
 * "Trade journey": every owner this item has had, e.g.
 * Denise → Maya (swap) → Leo (Mystery Swap Night).
 */
export async function ItemJourney({ listingId }: { listingId: string }) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("listing_transfers")
    .select(
      `id, created_at, trade_id,
       from:profiles!listing_transfers_from_user_fkey ( username, display_name ),
       to:profiles!listing_transfers_to_user_fkey ( username, display_name ),
       event:events!listing_transfers_event_id_fkey ( id, title )`,
    )
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });
  const steps = (data ?? []) as unknown as Step[];
  if (steps.length === 0) return null;

  return (
    <section aria-labelledby="journey-heading" className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <h2 id="journey-heading" className="flex items-center gap-1.5 text-sm font-extrabold">
        <Route aria-hidden="true" size={16} />
        Trade journey · {steps.length} {steps.length === 1 ? "swap" : "swaps"}
      </h2>
      <ol className="space-y-2 border-l-2 border-accent-soft pl-4 text-sm">
        {steps[0].from && (
          <li>
            First owned by <Person p={steps[0].from} />
          </li>
        )}
        {steps.map((step) => (
          <li key={step.id}>
            → <Person p={step.to} />{" "}
            <span className="text-muted">
              {step.event ? (
                <>
                  in{" "}
                  <Link href={`/events/${step.event.id}`} className="font-bold text-accent hover:underline">
                    {step.event.title}
                  </Link>
                </>
              ) : (
                "in a swap"
              )}{" "}
              · {timeAgo(step.created_at)}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

function Person({ p }: { p: { username: string; display_name: string } | null }) {
  if (!p) return <span className="text-muted">a former member</span>;
  return (
    <Link href={`/u/${p.username}`} className="font-bold hover:underline">
      {p.display_name}
    </Link>
  );
}
