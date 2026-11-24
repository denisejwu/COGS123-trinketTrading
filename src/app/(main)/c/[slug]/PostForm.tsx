"use client";

import { useActionState } from "react";
import { TextAreaField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";
import { addPost } from "./actions";

/** Form for a new discussion thread, or a reply when `parentId` is given. */
export function PostForm({
  communityId,
  communitySlug,
  parentId,
  label,
  placeholder,
  submitLabel,
}: {
  communityId: string;
  communitySlug: string;
  parentId?: string;
  label: string;
  placeholder: string;
  submitLabel: string;
}) {
  const [state, formAction] = useActionState(addPost, initialFormState);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="slug" value={communitySlug} />
      {parentId && <input type="hidden" name="parent_id" value={parentId} />}
      <TextAreaField
        label={label}
        name="body"
        id={parentId ? `reply-${parentId}` : "new-post"}
        required
        maxLength={2000}
        placeholder={placeholder}
        className="min-h-20"
        // React clears the form after sending; refill it only if there was an error.
        defaultValue={state.status === "error" ? state.values?.body : undefined}
      />
      {state.status === "error" && <FormMessage state={state} />}
      <SubmitButton pendingText="Posting…">{submitLabel}</SubmitButton>
    </form>
  );
}
