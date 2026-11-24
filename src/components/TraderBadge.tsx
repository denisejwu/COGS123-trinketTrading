import { Sparkles, Star } from "lucide-react";

/**
 * Shows how experienced a trader is: number of completed trades and their
 * average rating. People with 0 completed trades get a "New trader" label.
 */
export function TraderBadge({
  tradesCompleted,
  ratingAvg,
  ratingCount,
  showHint = false,
}: {
  tradesCompleted: number;
  ratingAvg: number | null;
  ratingCount: number;
  /** Adds a short explanation underneath (used on profile pages). */
  showHint?: boolean;
}) {
  if (tradesCompleted === 0) {
    return (
      <span className="inline-flex flex-col items-start gap-0.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-warning-soft px-2.5 py-0.5 text-xs font-bold text-navy">
          <Sparkles aria-hidden="true" size={12} />
          New trader
        </span>
        {showHint && (
          <span className="text-xs text-muted">Hasn&apos;t completed a trade on PopSwap yet</span>
        )}
      </span>
    );
  }

  const tradesLabel = `${tradesCompleted} ${tradesCompleted === 1 ? "trade" : "trades"}`;
  const hasRating = ratingCount > 0 && ratingAvg !== null;

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span className="inline-flex items-center gap-1.5 rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-bold text-navy">
        <span>{tradesLabel}</span>
        {hasRating && (
          <>
            <span aria-hidden="true">·</span>
            <Star aria-hidden="true" size={12} className="fill-current text-accent" />
            <span>
              {Number(ratingAvg).toFixed(1)}
              <span className="sr-only">
                {" "}
                average rating out of 5, from {ratingCount}{" "}
                {ratingCount === 1 ? "review" : "reviews"}
              </span>
            </span>
          </>
        )}
      </span>
      {showHint && (
        <span className="text-xs text-muted">
          Completed trades on PopSwap
          {hasRating ? ` · ${ratingCount} ${ratingCount === 1 ? "review" : "reviews"}` : ""}
        </span>
      )}
    </span>
  );
}
