import type { ListingCardData } from "@/lib/listings";
import { ListingCard } from "./ListingCard";

/** A responsive grid of listing cards (1 column on phones, 2 on desktop). */
export function ListingGrid({
  listings,
  showCommunity = false,
  empty,
}: {
  listings: ListingCardData[];
  showCommunity?: boolean;
  /** What to show when there are no listings. */
  empty: React.ReactNode;
}) {
  if (listings.length === 0) return <>{empty}</>;
  return (
    <ul className="grid gap-4 md:grid-cols-2">
      {listings.map((listing) => (
        <li key={listing.id}>
          <ListingCard listing={listing} showCommunity={showCommunity} />
        </li>
      ))}
    </ul>
  );
}
