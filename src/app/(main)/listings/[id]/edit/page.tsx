import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ListingForm } from "@/components/listings/ListingForm";
import { Notice } from "@/components/ui/Notice";
import { requireUserId } from "@/lib/auth";
import { getCommunityOptions } from "@/lib/community-options";
import { UUID_PATTERN } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Edit listing" };

export default async function EditListingPage({ params }: PageProps<"/listings/[id]/edit">) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const userId = await requireUserId();
  const supabase = await createClient();
  const { data: listing } = await supabase
    .from("listings")
    .select("*, listing_images ( path, position )")
    .eq("id", id)
    .maybeSingle();

  // Only the owner gets an edit page.
  if (!listing || listing.owner_id !== userId) notFound();

  const communities = await getCommunityOptions(userId);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/listings/${listing.id}`} className="text-sm font-bold text-accent hover:underline">
          ← Back to listing
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Edit listing</h1>
      </div>

      {listing.status !== "available" ? (
        <Notice tone="info">This listing is part of a trade, so it can&apos;t be edited right now.</Notice>
      ) : (
        <div className="rounded-3xl border border-line bg-card p-5 sm:p-6">
          <ListingForm
            userId={userId}
            communities={communities}
            initial={{
              id: listing.id,
              community_id: listing.community_id,
              title: listing.title,
              description: listing.description,
              condition: listing.condition,
              rarity: listing.rarity,
              size: listing.size,
              looking_for: listing.looking_for,
              for_trade: listing.for_trade,
              image_paths: [...listing.listing_images]
                .sort((a, b) => a.position - b.position)
                .map((i) => i.path),
            }}
          />
        </div>
      )}
    </div>
  );
}
