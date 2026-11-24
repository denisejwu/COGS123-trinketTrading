import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProposalBuilder } from "@/components/trades/ProposalBuilder";
import { requireUserId } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/listings";
import { getNegotiation, getTradeableItems } from "@/lib/negotiations";

export const metadata: Metadata = { title: "Counter-offer" };

export default async function CounterOfferPage({ params }: PageProps<"/offers/[id]/counter">) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const myId = await requireUserId();
  const negotiation = await getNegotiation(id, myId);
  if (!negotiation) notFound();
  if (negotiation.status !== "pending") redirect(`/offers/${id}`);

  const [myItems, theirItems] = await Promise.all([
    getTradeableItems(negotiation.me.id),
    getTradeableItems(negotiation.other.id),
  ]);
  // Start from the current proposal, so you only change what you want.
  const current = negotiation.currentRound?.items.map((i) => i.id) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/offers/${id}`} className="text-sm font-bold text-accent hover:underline">
          ← Back to the negotiation
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Counter-offer</h1>
        <p className="max-w-prose text-muted">
          Change what each of you gives. {negotiation.other.display_name} can then accept it or counter again.
        </p>
      </div>

      <ProposalBuilder
        mode="counter"
        offerId={id}
        otherName={negotiation.other.display_name}
        myItems={myItems}
        theirItems={theirItems}
        initialSelected={current}
      />
    </div>
  );
}
