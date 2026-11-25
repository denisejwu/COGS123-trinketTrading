import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, MapPin, MessageCircle, Pencil, Search, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { TraderBadge } from "@/components/TraderBadge";
import { CommentForm } from "@/components/listings/CommentForm";
import { DeleteListingButton } from "@/components/listings/DeleteListingButton";
import { ListingGallery } from "@/components/listings/ListingGallery";
import { ListingStatusChip } from "@/components/listings/ListingStatusChip";
import { RarityChip } from "@/components/listings/RarityChip";
import { RarityVotes } from "@/components/listings/RarityVotes";
import { WantButton } from "@/components/listings/WantButton";
import { ItemJourney } from "@/components/listings/ItemJourney";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth";
import { plural, timeAgo } from "@/lib/format";
import { conditionLabel, CONDITIONS, UUID_PATTERN } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { deleteComment } from "../actions";

async function getListing(id: string) {
  if (!UUID_PATTERN.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("listings")
    .select(
      `*, listing_images ( path, position ),
       owner:profiles!listings_owner_id_fkey ( id, username, display_name, avatar_path, trades_completed, rating_avg, rating_count, location ),
       community:communities!listings_community_id_fkey ( slug, name )`,
    )
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function generateMetadata({ params }: PageProps<"/listings/[id]">): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListing(id);
  return { title: listing?.title ?? "Listing not found" };
}

export default async function ListingPage({ params }: PageProps<"/listings/[id]">) {
  const { id } = await params;
  const [listing, myId] = await Promise.all([getListing(id), requireUserId()]);
  if (!listing) notFound();

  const supabase = await createClient();
  const [{ data: comments }, { data: votes }, { data: wants }, { data: myOffer }, { data: openOffers }] =
    await Promise.all([
      supabase
        .from("listing_comments")
        .select("id, body, created_at, author_id, author:profiles!listing_comments_author_id_fkey ( username, display_name, avatar_path )")
        .eq("listing_id", listing.id)
        .order("created_at", { ascending: true }),
      supabase.from("listing_rarity_votes").select("voter_id, rarity").eq("listing_id", listing.id),
      supabase.from("listing_wants").select("user_id").eq("listing_id", listing.id),
      // Do I already have an open negotiation for this item?
      supabase
        .from("offers")
        .select("id")
        .eq("listing_id", listing.id)
        .eq("sender_id", myId)
        .eq("status", "pending")
        .maybeSingle(),
      supabase.rpc("open_offer_count", { p_listing_id: listing.id }),
    ]);

  const isOwner = listing.owner_id === myId;
  const photos = [...listing.listing_images].sort((a, b) => a.position - b.position).map((i) => i.path);
  const conditionHint = CONDITIONS.find((c) => c.value === listing.condition)?.hint;
  const canOffer = !isOwner && listing.for_trade && listing.status === "available";
  const myVote = votes?.find((v) => v.voter_id === myId)?.rarity ?? null;
  const iWant = Boolean(wants?.some((w) => w.user_id === myId));
  const openOfferCount = openOffers ?? 0;

  return (
    <div className="space-y-8">
      <Link href={`/c/${listing.community.slug}`} className="text-sm font-bold text-accent hover:underline">
        ← {listing.community.name}
      </Link>

      <div className="grid gap-8 md:grid-cols-2">
        <ListingGallery paths={photos} title={listing.title} />

        <div className="space-y-5">
          <div className="space-y-2">
            <div className="flex flex-wrap gap-1.5 text-xs font-bold">
              <span className="rounded-full bg-card px-2.5 py-1 text-navy ring-1 ring-line" title={conditionHint}>
                {conditionLabel(listing.condition)}
              </span>
              <RarityChip rarity={listing.rarity} showUnsure />
              <ListingStatusChip status={listing.status} forTrade={listing.for_trade} />
              {openOfferCount > 0 && listing.status === "available" && (
                <span className="rounded-full bg-warning-soft px-2.5 py-1 text-navy">
                  {plural(openOfferCount, "open offer")}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-extrabold md:text-3xl">{listing.title}</h1>
            <p className="text-sm text-muted">
              Posted {timeAgo(listing.created_at)} in{" "}
              <Link href={`/c/${listing.community.slug}`} className="font-bold text-accent hover:underline">
                {listing.community.name}
              </Link>
            </p>
          </div>

          {listing.looking_for && (
            <div className="rounded-2xl bg-accent-soft p-4">
              <p className="flex items-center gap-1.5 text-sm font-extrabold text-accent">
                <Search aria-hidden="true" size={16} />
                Looking for
              </p>
              <p className="mt-1">{listing.looking_for}</p>
            </div>
          )}

          {/* ---------- Actions ---------- */}
          {isOwner ? (
            listing.status === "available" ? (
              <div className="flex flex-wrap gap-2">
                <Link href={`/listings/${listing.id}/edit`} className={buttonClasses("secondary")}>
                  <Pencil aria-hidden="true" size={18} />
                  Edit
                </Link>
                <DeleteListingButton listingId={listing.id} />
              </div>
            ) : (
              <Notice tone="info">This listing is part of a trade, so it can&apos;t be edited right now.</Notice>
            )
          ) : myOffer ? (
            <Link href={`/offers/${myOffer.id}`} className={buttonClasses("primary", "w-full sm:w-auto")}>
              <MessageCircle aria-hidden="true" size={18} />
              Continue your negotiation
            </Link>
          ) : canOffer ? (
            <div className="space-y-1">
              <Link href={`/listings/${listing.id}/offer`} className={buttonClasses("primary", "w-full sm:w-auto")}>
                <ArrowLeftRight aria-hidden="true" size={18} />
                Make an offer
              </Link>
              <p className="text-xs text-muted">
                Pick items to offer, then chat and counter until you both agree.
              </p>
            </div>
          ) : !listing.for_trade ? (
            <Notice tone="info">Showcase only. {listing.owner.display_name} is showing this off, not trading it.</Notice>
          ) : listing.status === "pending" ? (
            <Notice tone="warning">A trade for this item is being arranged.</Notice>
          ) : (
            <Notice tone="success">This item has already been traded.</Notice>
          )}

          <WantButton
            listingId={listing.id}
            wanted={iWant}
            count={wants?.length ?? 0}
            canWant={!isOwner}
          />

          <RarityVotes
            listingId={listing.id}
            ownerRarity={listing.rarity}
            votes={votes ?? []}
            myVote={myVote}
            canVote={!isOwner}
          />

          {(listing.description || listing.size) && (
            <dl className="space-y-3">
              {listing.description && (
                <div>
                  <dt className="text-sm font-bold">Description</dt>
                  <dd className="whitespace-pre-line text-navy">{listing.description}</dd>
                </div>
              )}
              {listing.size && (
                <div>
                  <dt className="text-sm font-bold">Size</dt>
                  <dd>{listing.size}</dd>
                </div>
              )}
            </dl>
          )}

          {/* ---------- Owner (items can change owners in swaps) ---------- */}
          <div className="rounded-2xl border border-line bg-card p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">Owned by</p>
            <Link href={`/u/${listing.owner.username}`} className="mt-2 flex items-center gap-3 hover:underline">
              <Avatar path={listing.owner.avatar_path} name={listing.owner.display_name} size={44} />
              <span>
                <span className="block font-extrabold">{listing.owner.display_name}</span>
                <span className="block text-sm text-muted">@{listing.owner.username}</span>
              </span>
            </Link>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <TraderBadge
                tradesCompleted={listing.owner.trades_completed}
                ratingAvg={listing.owner.rating_avg}
                ratingCount={listing.owner.rating_count}
              />
              {listing.owner.location && (
                <span className="flex items-center gap-1 text-xs text-muted">
                  <MapPin aria-hidden="true" size={14} />
                  {listing.owner.location}
                </span>
              )}
            </div>
          </div>

          <ItemJourney listingId={listing.id} />
        </div>
      </div>

      {/* ---------- Comments ---------- */}
      <section aria-labelledby="comments-heading" className="max-w-2xl space-y-4">
        <div>
          <h2 id="comments-heading" className="flex items-center gap-2 text-lg font-extrabold">
            <MessageCircle aria-hidden="true" size={20} />
            Comments {comments && comments.length > 0 && <span className="text-muted">({comments.length})</span>}
          </h2>
          <p className="text-sm text-muted">Public questions about this item. Everyone can see these.</p>
        </div>

        {comments && comments.length > 0 ? (
          <ul className="space-y-3">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3 rounded-2xl bg-accent-soft p-3">
                <Avatar path={comment.author.avatar_path} name={comment.author.display_name} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <Link href={`/u/${comment.author.username}`} className="font-bold hover:underline">
                      {comment.author.display_name}
                    </Link>{" "}
                    <span className="text-xs text-muted">{timeAgo(comment.created_at)}</span>
                  </p>
                  <p className="whitespace-pre-line break-words">{comment.body}</p>
                </div>
                {(comment.author_id === myId || isOwner) && (
                  <form action={deleteComment}>
                    <input type="hidden" name="comment_id" value={comment.id} />
                    <input type="hidden" name="listing_id" value={listing.id} />
                    <button
                      type="submit"
                      aria-label="Delete this comment"
                      className="rounded-full p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                    >
                      <Trash2 aria-hidden="true" size={16} />
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">No comments yet. Ask a question!</p>
        )}

        <CommentForm listingId={listing.id} />
      </section>
    </div>
  );
}
