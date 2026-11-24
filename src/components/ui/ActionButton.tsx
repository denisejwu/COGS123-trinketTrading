"use client";

import { useActionState } from "react";
import type { FormState } from "@/lib/validation";
import { initialFormState } from "@/lib/validation";
import { Notice } from "./Notice";
import { SubmitButton } from "./SubmitButton";
import type { ButtonVariant } from "./button";

/**
 * A one-button form that runs a server action and shows any error under
 * the button, e.g. Accept / Decline. Optionally asks "are you sure?" first.
 */
export function ActionButton({
  action,
  fields,
  children,
  pendingText,
  variant = "primary",
  className = "",
  confirmText,
}: {
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  /** Hidden inputs sent with the form, e.g. { offer_id: "..." }. */
  fields: Record<string, string>;
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
  confirmText?: string;
}) {
  const [state, formAction] = useActionState(action, initialFormState);

  return (
    <form
      action={formAction}
      onSubmit={(event) => {
        if (confirmText && !window.confirm(confirmText)) event.preventDefault();
      }}
      className="space-y-2"
    >
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      <SubmitButton variant={variant} pendingText={pendingText} className={className}>
        {children}
      </SubmitButton>
      {state.status === "error" && state.message && <Notice tone="error">{state.message}</Notice>}
    </form>
  );
}
