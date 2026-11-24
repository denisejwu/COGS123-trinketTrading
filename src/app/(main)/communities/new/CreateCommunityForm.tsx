"use client";

import { useActionState, useState } from "react";
import { ImageUploadButton } from "@/components/ImageUploadButton";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";
import { createCommunity } from "../actions";

export function CreateCommunityForm({ userId }: { userId: string }) {
  const [state, formAction] = useActionState(createCommunity, initialFormState);
  const [cover, setCover] = useState<{ path: string; preview: string } | null>(null);
  const [uploading, setUploading] = useState(false);
  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <FormMessage state={state} />
      <TextField
        label="Name"
        name="name"
        required
        maxLength={50}
        placeholder="e.g. Sanrio Swaps"
        hint="Also becomes the web address, e.g. /c/sanrio-swaps"
        error={errors.name}
        defaultValue={state.values?.name}
      />
      <TextAreaField
        label="Description"
        name="description"
        required
        maxLength={500}
        placeholder="What do people collect and trade here?"
        hint="Shown on the community page and in search. Up to 500 characters."
        error={errors.description}
        defaultValue={state.values?.description}
      />

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">
          Cover image <span className="font-normal text-muted">(optional)</span>
        </legend>
        {cover && (
          // A local preview of the just-uploaded image (a blob: URL, so not next/image).
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cover.preview} alt="Cover preview" className="h-32 w-full rounded-2xl object-cover" />
        )}
        <ImageUploadButton
          bucket="community-covers"
          userId={userId}
          label={cover ? "Change cover" : "Upload a cover"}
          onUploaded={(path, preview) => setCover({ path, preview })}
          onBusyChange={setUploading}
        />
        <p className="text-xs text-muted">A wide photo works best. Without one we&apos;ll use a colour and icon.</p>
        {errors.cover_path && <p className="text-xs font-semibold text-danger">{errors.cover_path}</p>}
        <input type="hidden" name="cover_path" value={cover?.path ?? ""} />
      </fieldset>

      <SubmitButton pendingText="Creating…" disabled={uploading}>
        Create community
      </SubmitButton>
    </form>
  );
}
