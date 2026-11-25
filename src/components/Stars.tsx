import { Star } from "lucide-react";

/** Read-only star rating, e.g. ★★★★☆ with "4 out of 5 stars" for screen readers. */
export function Stars({ rating, size = 16 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          aria-hidden="true"
          size={size}
          className={n <= Math.round(rating) ? "fill-[#f5b301] text-[#f5b301]" : "text-line"}
        />
      ))}
    </span>
  );
}
