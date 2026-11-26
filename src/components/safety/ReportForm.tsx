"use client";

import { useActionState } from "react";
import { Flag } from "lucide-react";
import { reportContent } from "@/app/(main)/safety/actions";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";

/** A small "Report" link that opens a one-field form. */
export function ReportForm({ userId, listingId, label }: { userId?: string; listingId?: string; label: string }) {
  const [state, formAction] = useActionState(reportContent, initialFormState);
  const id = listingId ? `report-${listingId}` : `report-${userId}`;

  return (
    <details className="text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1 font-bold text-muted hover:text-danger">
        <Flag aria-hidden="true" size={14} />
        {label}
      </summary>
      {state.status === "success" ? (
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      ) : (
        <form action={formAction} className="mt-2 space-y-2">
          {userId && <input type="hidden" name="user_id" value={userId} />}
          {listingId && <input type="hidden" name="listing_id" value={listingId} />}
          <label htmlFor={id} className="block text-xs font-bold">
            What&apos;s wrong?
          </label>
          <textarea
            id={id}
            name="reason"
            required
            maxLength={500}
            defaultValue={state.values?.reason}
            placeholder="e.g. fake item, rude messages, didn't follow through"
            className="block min-h-20 w-full rounded-2xl border border-line bg-card px-3 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          {state.status === "error" && <FormMessage state={state} />}
          <SubmitButton variant="danger" pendingText="Sending…" className="!px-4 !py-2 text-xs">
            Send report
          </SubmitButton>
        </form>
      )}
    </details>
  );
}
