import { Gem } from "lucide-react";
import { rarityLabel } from "@/lib/fairness";
import type { ListingRarity } from "@/lib/types";

const STYLES: Record<ListingRarity, string> = {
  common: "bg-cream text-navy",
  uncommon: "bg-success-soft text-success",
  rare: "bg-accent-soft text-accent",
  secret: "bg-[#f1e8fb] text-[#6b2fb3]",
  unsure: "",
};

/** Small rarity label. "Not sure" isn't shown, to keep cards tidy. */
export function RarityChip({ rarity, showUnsure = false }: { rarity: ListingRarity; showUnsure?: boolean }) {
  if (rarity === "unsure" && !showUnsure) return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 ${STYLES[rarity] || "bg-cream text-muted"}`}
    >
      <Gem aria-hidden="true" size={12} />
      {rarityLabel(rarity)}
    </span>
  );
}
