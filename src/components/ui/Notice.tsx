import type { FormState } from "@/lib/validation";

const tones = {
  info: "bg-accent-soft text-navy",
  success: "bg-success-soft text-success",
  error: "bg-danger-soft text-danger",
  warning: "bg-warning-soft text-navy",
} as const;

/** A coloured message box. Errors are announced to screen readers right away. */
export function Notice({
  tone = "info",
  children,
}: {
  tone?: keyof typeof tones;
  children: React.ReactNode;
}) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-2xl px-4 py-3 text-sm font-semibold ${tones[tone]}`}
    >
      {children}
    </div>
  );
}

/** Shows the message returned by a form's server action, if there is one. */
export function FormMessage({ state }: { state: FormState }) {
  if (state.status === "idle" || !state.message) return null;
  return <Notice tone={state.status === "error" ? "error" : "success"}>{state.message}</Notice>;
}
