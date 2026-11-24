"use client";

import { useActionState } from "react";
import { TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState } from "@/lib/validation";
import { requestPasswordReset } from "../actions";

export function RequestResetForm() {
  const [state, formAction] = useActionState(requestPasswordReset, initialFormState);

  return (
    <form action={formAction} className="space-y-4">
      <FormMessage state={state} />
      {state.status !== "success" && (
        <>
          <TextField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            defaultValue={state.values?.email}
          />
          <SubmitButton pendingText="Sending…" className="w-full">
            Send reset link
          </SubmitButton>
        </>
      )}
    </form>
  );
}
