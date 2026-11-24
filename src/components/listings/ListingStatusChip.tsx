import type { ListingStatus } from "@/lib/types";

/**
 * Small label for anything other than a normal "available, up for trade"
 * listing: Showcase only, Trade pending, or Traded.
 */
export function ListingStatusChip({
  status,
  forTrade,
}: {
  status: ListingStatus;
  forTrade: boolean;
}) {
  if (status === "pending") {
    return (
      <span className="rounded-full bg-warning-soft px-2 py-0.5 text-navy" title="Part of a trade that's being arranged">
        Trade pending
      </span>
    );
  }
  if (status === "traded") {
    return <span className="rounded-full bg-success-soft px-2 py-0.5 text-success">Traded</span>;
  }
  if (!forTrade) {
    return (
      <span className="rounded-full bg-accent-soft px-2 py-0.5 text-accent" title="Shown off, not up for trade">
        Showcase only
      </span>
    );
  }
  return null;
}
