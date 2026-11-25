"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { addEntry } from "@/app/(main)/events/actions";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";

/**
 * Add something to an event: pick one of your items (swap meet, mystery
 * swap, contest, theme day) or upload a photo of your pull (unboxing).
 */
export function AddEntryForm({
  eventId,
  userId,
  mode,
  items,
  submitLabel,
  emptyHint,
}: {
  eventId: string;
  userId: string;
  mode: "listing" | "photo";
  items: { id: string; title: string }[];
  submitLabel: string;
  emptyHint: string;
}) {
  const [state, formAction] = useActionState(addEntry, initialFormState);
  const [photo, setPhoto] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  if (mode === "listing" && items.length === 0) {
    return (
      <p className="text-sm text-muted">
        {emptyHint}{" "}
        <Link href="/listings/new" className="font-bold text-accent hover:underline">
          Post a listing
        </Link>
      </p>
    );
  }

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="event_id" value={eventId} />
      {state.status === "error" && <FormMessage state={state} />}

      {mode === "listing" ? (
        <div className="space-y-1">
          <label htmlFor={`entry-item-${eventId}`} className="block text-sm font-bold">
            Which item?
          </label>
          <select
            id={`entry-item-${eventId}`}
            name="listing_id"
            required
            defaultValue=""
            className="block w-full rounded-2xl border border-line bg-card px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="" disabled>
              Choose one of your items…
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.title}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <div className="space-y-2">
          <p className="text-sm font-bold">Photo of your pull</p>
          {photo && (
            // Local preview (blob: URL), so a plain <img>.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={photo.preview} alt="Your photo" className="h-40 w-40 rounded-2xl object-cover" />
          )}
          <ImageUploadButton
            bucket="listing-images"
            userId={userId}
            label={photo ? "Change photo" : "Take or choose a photo"}
            onUploaded={(path, preview) => setPhoto({ path, preview })}
            onBusyChange={setUploading}
          />
          <input type="hidden" name="photo_path" value={photo?.path ?? ""} />
        </div>
      )}

      <div className="space-y-1">
        <label htmlFor={`entry-caption-${eventId}`} className="block text-sm font-bold">
          Caption <span className="font-normal text-muted">(optional)</span>
        </label>
        <input
          id={`entry-caption-${eventId}`}
          name="caption"
          maxLength={300}
          placeholder={mode === "photo" ? "e.g. Finally got the secret!" : "e.g. Note for whoever gets this"}
          defaultValue={state.status === "error" ? state.values?.caption : undefined}
          className="block w-full rounded-2xl border border-line bg-card px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
      </div>

      <SubmitButton pendingText="Adding…" disabled={uploading || (mode === "photo" && !photo)}>
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
