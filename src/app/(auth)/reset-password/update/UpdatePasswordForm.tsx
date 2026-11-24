"use client";

import { useActionState } from "react";
import Link from "next/link";
import { TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClasses } from "@/components/ui/button";
import { initialFormState, MIN_PASSWORD_LENGTH } from "@/lib/validation";
import { updatePassword } from "../../actions";

export function UpdatePasswordForm() {
  const [state, formAction] = useActionState(updatePassword, initialFormState);

  if (state.status === "success") {
    return (
      <div className="space-y-4">
        <FormMessage state={state} />
        <Link href="/" className={buttonClasses("primary", "w-full")}>
          Go to PopSwap
        </Link>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};
  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField
        label="New password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={errors.password}
      />
      <TextField
        label="Type it again"
        name="confirm"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirm}
      />
      <SubmitButton pendingText="Updating…" className="w-full">
        Update password
      </SubmitButton>
    </form>
  );
}
