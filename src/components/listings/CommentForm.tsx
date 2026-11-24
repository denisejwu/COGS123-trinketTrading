"use client";

import { useActionState } from "react";
import { addComment } from "@/app/(main)/listings/actions";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";

export function CommentForm({ listingId }: { listingId: string }) {
  const [state, formAction] = useActionState(addComment, initialFormState);

  return (
    <form action={formAction} className="space-y-2">
      <input type="hidden" name="listing_id" value={listingId} />
      <label htmlFor="comment-body" className="sr-only">
        Add a comment
      </label>
      <textarea
        id="comment-body"
        name="body"
        required
        maxLength={500}
        placeholder="Ask about the item, condition or shipping…"
        defaultValue={state.status === "error" ? state.values?.body : undefined}
        className="block min-h-20 w-full rounded-2xl border border-line bg-card px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
      />
      {state.status === "error" && <FormMessage state={state} />}
      <SubmitButton pendingText="Posting…">Comment</SubmitButton>
    </form>
  );
}
