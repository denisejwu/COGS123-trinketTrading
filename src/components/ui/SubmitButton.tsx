"use client";

import { useFormStatus } from "react-dom";
import { buttonClasses, type ButtonVariant } from "./button";

/**
 * A submit button that disables itself and changes its text while the form
 * is being sent, so people don't double-submit.
 */
export function SubmitButton({
  children,
  pendingText = "Saving…",
  variant = "primary",
  className = "",
}: {
  children: React.ReactNode;
  pendingText?: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClasses(variant, className)}>
      {pending ? pendingText : children}
    </button>
  );
}
