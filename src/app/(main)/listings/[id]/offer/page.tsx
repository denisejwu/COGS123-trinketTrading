import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ProposalBuilder } from "@/components/trades/ProposalBuilder";
import { Notice } from "@/components/ui/Notice";
import { requireUserId } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/listings";
import { getTradeableItems } from "@/lib/negotiations";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Make an offer" };

export default async function MakeOfferPage({ params, searchParams }: PageProps<"/listings/[id]/offer">) {
  const { id } = await params;
  const { give } = await searchParams;
  if (!UUID_PATTERN.test(id)) notFound();

  const myId = await requireUserId();
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("id, title, status, for_trade, owner_id, owner:profiles!listings_owner_id_fkey ( display_name )")
    .eq("id", id)
    .maybeSingle();
  if (!listing) notFound();
  if (listing.owner_id === myId) redirect(`/listings/${id}`);

  // Already negotiating for this item? Go back to that conversation.
  const { data: existing } = await supabase
    .from("offers")
    .select("id")
    .eq("listing_id", id)
    .eq("sender_id", myId)
    .eq("status", "pending")
    .maybeSingle();
  if (existing) redirect(`/offers/${existing.id}`);

  const ownerName = listing.owner.display_name;

  if (listing.status !== "available" || !listing.for_trade) {
    return (
      <div className="mx-auto max-w-2xl space-y-4">
        <h1 className="text-2xl font-extrabold">Make an offer</h1>
        <Notice tone="info">This item isn&apos;t available for trade right now.</Notice>
        <Link href={`/listings/${id}`} className="font-bold text-accent hover:underline">
          ← Back to the listing
        </Link>
      </div>
    );
  }

  const [myItems, theirItems] = await Promise.all([getTradeableItems(myId), getTradeableItems(listing.owner_id)]);
  const preselectMine = typeof give === "string" && myItems.some((i) => i.id === give) ? [give] : [];

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/listings/${id}`} className="text-sm font-bold text-accent hover:underline">
          ← {listing.title}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Make an offer to {ownerName}</h1>
        <p className="max-w-prose text-muted">
          Pick what you&apos;d give. You can also ask for more of {ownerName}&apos;s items. Nothing is final
          until one of you accepts. You can chat and send counter-offers first.
        </p>
      </div>

      <ProposalBuilder
        mode="start"
        targetListingId={id}
        otherName={ownerName}
        myItems={myItems}
        theirItems={theirItems}
        initialSelected={[id, ...preselectMine]}
      />
    </div>
  );
}
