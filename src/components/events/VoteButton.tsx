"use client";

import { useActionState } from "react";
import { Heart, Vote } from "lucide-react";
import { toggleVote } from "@/app/(main)/events/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";

/** Heart (most events) or Vote (contest) button with its count. */
export function VoteButton({
  eventId,
  entryId,
  count,
  voted,
  kind,
  disabled = false,
}: {
  eventId: string;
  entryId: string;
  count: number;
  voted: boolean;
  kind: "heart" | "vote";
  disabled?: boolean;
}) {
  const [state, formAction] = useActionState(toggleVote, initialFormState);
  const Icon = kind === "heart" ? Heart : Vote;
  const label = kind === "heart" ? (voted ? "Hearted" : "Heart") : voted ? "Your vote" : "Vote";

  return (
    <form action={formAction} className="space-y-1">
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="entry_id" value={entryId} />
      <SubmitButton
        variant={voted ? "primary" : "secondary"}
        pendingText="…"
        disabled={disabled}
        className="!px-3 !py-1.5 text-xs"
      >
        <Icon aria-hidden="true" size={14} className={voted && kind === "heart" ? "fill-current" : ""} />
        <span aria-pressed={voted}>{label}</span>
        <span className="opacity-80">{count}</span>
      </SubmitButton>
      {state.status === "error" && <p className="text-xs font-semibold text-danger">{state.message}</p>}
    </form>
  );
}
