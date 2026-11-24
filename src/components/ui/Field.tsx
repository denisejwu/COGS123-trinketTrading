import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";

/**
 * Form fields with a real <label>, an optional grey hint line underneath,
 * and an error message that screen readers announce with the field.
 */

type CommonProps = {
  label: string;
  name: string;
  /** Small helper line under the field, e.g. "Used for the Nearby filter". */
  hint?: string;
  error?: string;
  /** Shows "(optional)" after the label. */
  optional?: boolean;
};

const inputBase =
  "block w-full rounded-2xl border bg-card px-4 py-2.5 text-base text-navy placeholder:text-muted/70 " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30";

function describedBy(id: string, hint?: string, error?: string) {
  const ids = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

function FieldFrame({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: Omit<CommonProps, "name"> & { id: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-bold">
        {label}
        {optional && <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

export function TextField({
  label,
  name,
  hint,
  error,
  optional,
  className = "",
  id,
  ...inputProps
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const fieldId = id ?? `field-${name}`;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      <input
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={`${inputBase} ${error ? "border-danger" : "border-line"} ${className}`}
        {...inputProps}
      />
    </FieldFrame>
  );
}

export function TextAreaField({
  label,
  name,
  hint,
  error,
  optional,
  className = "",
  id,
  ...textareaProps
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const fieldId = id ?? `field-${name}`;
  return (
    <FieldFrame id={fieldId} label={label} hint={hint} error={error} optional={optional}>
      <textarea
        id={fieldId}
        name={name}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        className={`${inputBase} min-h-24 ${error ? "border-danger" : "border-line"} ${className}`}
        {...textareaProps}
      />
    </FieldFrame>
  );
}
