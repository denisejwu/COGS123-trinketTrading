"use client";

import { useActionState } from "react";
import { MailCheck } from "lucide-react";
import { TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { initialFormState, MIN_PASSWORD_LENGTH, USERNAME_RULES } from "@/lib/validation";
import { signup } from "../actions";

export function SignupForm() {
  const [state, formAction] = useActionState(signup, initialFormState);

  // After a successful sign-up, swap the form for a "check your email" note.
  if (state.status === "success") {
    return (
      <div role="status" className="space-y-3 rounded-2xl bg-success-soft p-5 text-center">
        <MailCheck aria-hidden="true" className="mx-auto text-success" size={32} />
        <h2 className="font-extrabold text-success">Check your email</h2>
        <p className="text-sm text-navy">{state.message}</p>
        <p className="text-xs text-muted">
          Can&apos;t find it? Look in your spam folder. The link works best in this same browser.
        </p>
      </div>
    );
  }

  const errors = state.fieldErrors ?? {};

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField
        label="Display name"
        name="display_name"
        autoComplete="nickname"
        required
        maxLength={50}
        hint="How other traders see you, e.g. “Denise W.”"
        error={errors.display_name}
        defaultValue={state.values?.display_name}
      />
      <TextField
        label="Username"
        name="username"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        required
        maxLength={20}
        hint={`Used in your profile link. ${USERNAME_RULES}.`}
        error={errors.username}
        defaultValue={state.values?.username}
      />
      <TextField
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        required
        hint="We'll send a link to confirm it's you."
        error={errors.email}
        defaultValue={state.values?.email}
      />
      <TextField
        label="Password"
        name="password"
        type="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        hint={`At least ${MIN_PASSWORD_LENGTH} characters.`}
        error={errors.password}
      />
      <SubmitButton pendingText="Creating account…" className="w-full">
        Create account
      </SubmitButton>
    </form>
  );
}
