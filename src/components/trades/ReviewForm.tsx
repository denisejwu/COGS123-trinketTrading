"use client";

import { useActionState, useState } from "react";
import { Star } from "lucide-react";
import { leaveReview } from "@/app/(main)/trades/actions";
import { TextAreaField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { REVIEW_TAGS } from "@/lib/review-tags";
import { initialFormState } from "@/lib/validation";

/** Rate the other trader: 1-5 stars, quick tags, optional comment. */
export function ReviewForm({ tradeId, otherName }: { tradeId: string; otherName: string }) {
  const [state, formAction] = useActionState(leaveReview, initialFormState);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="trade_id" value={tradeId} />
      <FormMessage state={state} />

      {/* Stars are real radio buttons, so they work with a keyboard too. */}
      <fieldset>
        <legend className="text-sm font-bold">How was trading with {otherName}?</legend>
        <div className="mt-1 flex gap-1" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((n) => (
            <label
              key={n}
              className="cursor-pointer rounded-lg p-1 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
              onMouseEnter={() => setHover(n)}
            >
              <input
                type="radio"
                name="rating"
                value={n}
                checked={rating === n}
                onChange={() => setRating(n)}
                className="sr-only"
              />
              <Star
                aria-hidden="true"
                size={32}
                className={n <= (hover || rating) ? "fill-[#f5b301] text-[#f5b301]" : "text-line"}
              />
              <span className="sr-only">
                {n} {n === 1 ? "star" : "stars"}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend className="text-sm font-bold">
          What went well? <span className="font-normal text-muted">(pick any)</span>
        </legend>
        <div className="mt-1 flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => (
            <label
              key={tag.value}
              className="cursor-pointer rounded-full border border-line bg-card px-3 py-1.5 text-sm font-bold has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
            >
              <input type="checkbox" name="tags" value={tag.value} className="sr-only" />
              {tag.label}
            </label>
          ))}
        </div>
      </fieldset>

      <TextAreaField
        label="Comment"
        name="comment"
        optional
        maxLength={500}
        placeholder="Anything other collectors should know?"
        hint="Shows on their profile."
        defaultValue={state.values?.comment}
      />

      <SubmitButton disabled={rating === 0} pendingText="Posting…">
        Post review
      </SubmitButton>
    </form>
  );
}
