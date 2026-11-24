import { Heart } from "lucide-react";
import { toggleWant } from "@/app/(main)/offers/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { plural } from "@/lib/format";

/** "I want this" heart plus how many collectors want the item. */
export function WantButton({
  listingId,
  wanted,
  count,
  canWant,
}: {
  listingId: string;
  wanted: boolean;
  count: number;
  canWant: boolean;
}) {
  const label = count > 0 ? `${plural(count, "collector")} ${count === 1 ? "wants" : "want"} this` : null;

  return (
    <div className="flex flex-wrap items-center gap-3">
      {canWant && (
        <form action={toggleWant}>
          <input type="hidden" name="listing_id" value={listingId} />
          <input type="hidden" name="wanted" value={String(wanted)} />
          <SubmitButton
            variant="secondary"
            pendingText="…"
            className={wanted ? "!border-[#a1264a] !bg-[#fdecef] text-[#a1264a]" : ""}
          >
            <Heart aria-hidden="true" size={18} className={wanted ? "fill-current" : ""} />
            <span aria-pressed={wanted}>{wanted ? "You want this" : "I want this"}</span>
          </SubmitButton>
        </form>
      )}
      {label && <span className="text-sm font-bold text-[#a1264a]">{label}</span>}
    </div>
  );
}
