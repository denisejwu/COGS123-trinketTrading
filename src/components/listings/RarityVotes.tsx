import { Users } from "lucide-react";
import { voteRarity } from "@/app/(main)/offers/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RARITIES, rarityLabel, summarizeVotes, VOTES_NEEDED } from "@/lib/fairness";
import type { ListingRarity } from "@/lib/types";

/**
 * "Rarity check": the owner picks a rarity, and other collectors can vote
 * if they disagree. After enough votes, the community's pick is what the
 * fairness meter uses.
 */
export function RarityVotes({
  listingId,
  ownerRarity,
  votes,
  myVote,
  canVote,
}: {
  listingId: string;
  ownerRarity: ListingRarity;
  votes: { rarity: ListingRarity }[];
  myVote: ListingRarity | null;
  canVote: boolean;
}) {
  const summary = summarizeVotes(votes);
  const communityDecides = summary.total >= VOTES_NEEDED && summary.top;

  return (
    <section aria-labelledby="rarity-heading" className="space-y-3 rounded-2xl border border-line bg-card p-4">
      <div>
        <h2 id="rarity-heading" className="flex items-center gap-1.5 text-sm font-extrabold">
          <Users aria-hidden="true" size={16} />
          Rarity check
        </h2>
        <p className="text-sm">
          Owner says <strong>{rarityLabel(ownerRarity)}</strong>
          {summary.total > 0 && summary.top && (
            <>
              {" "}· Community says <strong>{rarityLabel(summary.top)}</strong> ({summary.total}{" "}
              {summary.total === 1 ? "vote" : "votes"})
            </>
          )}
        </p>
        <p className="text-xs text-muted">
          {communityDecides
            ? "The fairness meter uses the community's pick."
            : `After ${VOTES_NEEDED} votes, the community's pick is used in the fairness meter.`}
        </p>
      </div>

      {canVote && (
        <div>
          <p className="mb-1.5 text-xs font-bold">What rarity do you think this is?</p>
          <div className="flex flex-wrap gap-1.5">
            {RARITIES.filter((r) => r.value !== "unsure").map((r) => {
              const chosen = myVote === r.value;
              const count = summary.counts[r.value] ?? 0;
              return (
                <form key={r.value} action={voteRarity}>
                  <input type="hidden" name="listing_id" value={listingId} />
                  <input type="hidden" name="rarity" value={r.value} />
                  <input type="hidden" name="current" value={myVote ?? ""} />
                  <SubmitButton
                    variant={chosen ? "primary" : "secondary"}
                    pendingText="…"
                    className="!px-3 !py-1.5 text-xs"
                  >
                    <span aria-pressed={chosen}>
                      {r.label}
                      {count > 0 && <span className="ml-1 opacity-80">{count}</span>}
                    </span>
                  </SubmitButton>
                </form>
              );
            })}
          </div>
          {myVote && <p className="mt-1 text-xs text-muted">Tap your vote again to remove it.</p>}
        </div>
      )}
    </section>
  );
}
