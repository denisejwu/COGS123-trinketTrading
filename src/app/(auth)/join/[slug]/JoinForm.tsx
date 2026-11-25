"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";
import { joinRoom } from "../../actions";

/** One field, one button: your name, then you're in the room. */
export function JoinForm({ slug, signedInAs }: { slug: string; signedInAs: string | null }) {
  const [state, formAction] = useActionState(joinRoom, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="slug" value={slug} />
      <FormMessage state={state} />
      {signedInAs ? (
        <p className="text-sm">
          You&apos;re signed in as <strong>{signedInAs}</strong> on this device.
        </p>
      ) : (
        <TextField
          label="Your name"
          name="display_name"
          autoComplete="nickname"
          required
          maxLength={50}
          placeholder="e.g. Denise W."
          hint="This creates your trader profile. No email or password needed."
          error={state.fieldErrors?.display_name}
          defaultValue={state.values?.display_name}
        />
      )}
      <SubmitButton pendingText="Joining…" className="w-full">
        Join the room
      </SubmitButton>
    </form>
  );
}
