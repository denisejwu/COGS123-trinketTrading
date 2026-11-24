"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";
import { startWithName } from "../actions";

export function LoginForm({ next }: { next: string }) {
  // useActionState runs the server action and gives us back its result.
  const [state, formAction] = useActionState(startWithName, initialFormState);

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="next" value={next} />
      <FormMessage state={state} />
      <TextField
        label="Your name"
        name="display_name"
        autoComplete="nickname"
        required
        maxLength={50}
        placeholder="e.g. Denise W."
        hint="How other traders will see you. You can change it later in Settings."
        error={state.fieldErrors?.display_name}
        defaultValue={state.values?.display_name}
      />
      <SubmitButton pendingText="Setting things up…" className="w-full">
        Start trading
      </SubmitButton>
    </form>
  );
}
