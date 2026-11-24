import Image from "next/image";
import { ImageOff, Users } from "lucide-react";
import { RarityChip } from "@/components/listings/RarityChip";
import { conditionLabel } from "@/lib/listings";
import type { ProposalItem } from "@/lib/negotiations";
import { publicImageUrl } from "@/lib/storage";

/** Compact item row used in proposals: photo, title, condition, rarity, points. */
export function ProposalItemCard({ item, note }: { item: ProposalItem; note?: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-accent-soft">
        {item.coverPath ? (
          <Image
            src={publicImageUrl("listing-images", item.coverPath)}
            alt=""
            fill
            sizes="56px"
            className="object-cover"
          />
        ) : (
          <ImageOff aria-hidden="true" size={18} className="absolute inset-0 m-auto text-muted" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{item.title}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] font-bold">
          <span className="rounded-full bg-cream px-2 py-0.5 text-navy">{conditionLabel(item.condition)}</span>
          <RarityChip rarity={item.rarity} showUnsure />
          {item.rarityFromCommunity && (
            <span className="inline-flex items-center gap-0.5 text-muted" title="Rarity picked by community votes">
              <Users aria-hidden="true" size={11} />
              voted
            </span>
          )}
        </div>
        {note && <p className="mt-0.5 text-[11px] text-muted">{note}</p>}
      </div>
      <span className="shrink-0 rounded-full bg-accent-soft px-2 py-0.5 text-xs font-extrabold text-accent">
        {item.points} pts
      </span>
    </div>
  );
}
