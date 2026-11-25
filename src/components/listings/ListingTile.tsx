import Image from "next/image";
import Link from "next/link";
import { Heart, ImageOff } from "lucide-react";
import { conditionLabel, coverPhoto, type ListingCardData } from "@/lib/listings";
import { publicImageUrl } from "@/lib/storage";
import { ListingStatusChip } from "./ListingStatusChip";
import { RarityChip } from "./RarityChip";

/**
 * Photo-first tile for profile grids: a big, full photo of the trinket
 * with its name and labels underneath.
 */
export function ListingTile({ listing }: { listing: ListingCardData }) {
  const photo = coverPhoto(listing.listing_images);
  const wants = listing.listing_wants?.[0]?.count ?? 0;

  return (
    <Link
      href={`/listings/${listing.id}`}
      className="group block overflow-hidden rounded-3xl border border-line bg-card transition-shadow hover:shadow-md"
    >
      <div className="relative aspect-square bg-accent-soft">
        {photo ? (
          <Image
            src={publicImageUrl("listing-images", photo)}
            alt={listing.title}
            fill
            sizes="(min-width: 1024px) 240px, (min-width: 640px) 33vw, 50vw"
            className="object-cover transition-transform group-hover:scale-[1.03]"
          />
        ) : (
          <ImageOff aria-hidden="true" className="absolute inset-0 m-auto text-muted" />
        )}
        {wants > 0 && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-xs font-bold text-[#a1264a]">
            <Heart aria-hidden="true" size={12} className="fill-current" />
            {wants}
            <span className="sr-only">{wants === 1 ? "person wants" : "people want"} this</span>
          </span>
        )}
      </div>
      <div className="space-y-1 p-3">
        <p className="line-clamp-1 font-extrabold">{listing.title}</p>
        <div className="flex flex-wrap gap-1 text-[11px] font-bold">
          <span className="rounded-full bg-cream px-2 py-0.5 text-navy">{conditionLabel(listing.condition)}</span>
          <RarityChip rarity={listing.rarity} />
          <ListingStatusChip status={listing.status} forTrade={listing.for_trade} />
        </div>
      </div>
    </Link>
  );
}
