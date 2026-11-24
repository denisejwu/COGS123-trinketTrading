"use client";

import { Trash2 } from "lucide-react";
import { deleteListing } from "@/app/(main)/listings/actions";
import { SubmitButton } from "@/components/ui/SubmitButton";

/** Delete button that asks "are you sure?" before deleting. */
export function DeleteListingButton({ listingId }: { listingId: string }) {
  return (
    <form
      action={deleteListing}
      onSubmit={(event) => {
        if (!window.confirm("Delete this listing? This can't be undone.")) event.preventDefault();
      }}
    >
      <input type="hidden" name="listing_id" value={listingId} />
      <SubmitButton variant="ghost" pendingText="Deleting…" className="text-danger hover:bg-danger-soft">
        <Trash2 aria-hidden="true" size={18} />
        Delete
      </SubmitButton>
    </form>
  );
}
