import Image from "next/image";
import Link from "next/link";
import { ImageOff } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { TraderBadge } from "@/components/TraderBadge";
import { conditionLabel, coverPhoto, type ListingCardData } from "@/lib/listings";
import { publicImageUrl } from "@/lib/storage";
import { ListingStatusChip } from "./ListingStatusChip";

/**
 * Listing card from the prototype: photo on the left, title and
 * description on the right, "Posted by" with the trader badge at the bottom.
 *
 * The whole card is clickable (the title link stretches over it), while
 * the "Posted by" link stays separately clickable on top.
 */
export function ListingCard({
  listing,
  showCommunity = false,
}: {
  listing: ListingCardData;
  showCommunity?: boolean;
}) {
  const photo = coverPhoto(listing.listing_images);

  return (
    <article className="relative flex gap-4 rounded-3xl border border-line bg-card p-3 transition-shadow hover:shadow-md focus-within:shadow-md">
      {/* Photo */}
      <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-accent-soft sm:h-32 sm:w-32">
        {photo ? (
          <Image
            src={publicImageUrl("listing-images", photo)}
            alt=""
            fill
            sizes="128px"
            className="object-cover"
          />
        ) : (
          <ImageOff aria-hidden="true" className="absolute inset-0 m-auto text-muted" />
        )}
      </div>

      {/* Text */}
      <div className="flex min-w-0 flex-1 flex-col">
        <h3 className="line-clamp-1 font-extrabold">
          <Link
            href={`/listings/${listing.id}`}
            className="after:absolute after:inset-0 after:rounded-3xl after:content-[''] focus:outline-none"
          >
            {listing.title}
          </Link>
        </h3>
        {listing.description && (
          <p className="mt-0.5 line-clamp-2 text-sm text-muted">{listing.description}</p>
        )}

        <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-bold">
          <span className="rounded-full bg-cream px-2 py-0.5 text-navy">
            {conditionLabel(listing.condition)}
          </span>
          <ListingStatusChip status={listing.status} forTrade={listing.for_trade} />
          {showCommunity && (
            <span className="rounded-full bg-cream px-2 py-0.5 text-muted">
              {listing.community.name}
            </span>
          )}
        </div>

        {/* Posted by */}
        <div className="relative z-10 mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-2 text-xs">
          <span className="text-muted">Posted by</span>
          <Link
            href={`/u/${listing.owner.username}`}
            className="flex items-center gap-1.5 font-bold hover:underline"
          >
            <Avatar path={listing.owner.avatar_path} name={listing.owner.display_name} size={20} />
            {listing.owner.display_name}
          </Link>
          <TraderBadge
            tradesCompleted={listing.owner.trades_completed}
            ratingAvg={listing.owner.rating_avg}
            ratingCount={listing.owner.rating_count}
          />
        </div>
      </div>
    </article>
  );
}
