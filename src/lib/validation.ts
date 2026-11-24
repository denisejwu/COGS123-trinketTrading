/** Rules shared by forms and server actions. Keep in sync with the SQL checks. */

export const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;
export const USERNAME_RULES = "3–20 characters: lowercase letters, numbers and _";

/** Read a trimmed string from a submitted form (empty string if missing). */
export function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value.trim() : "";
}

/**
 * Only allow redirects to pages on our own site, e.g. "/listings/123".
 * Blocks tricks like "//evil.com" or "https://evil.com" (open redirects).
 */
export function safeNextPath(next: unknown, fallback = "/") {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

/** The shape every form action returns, so forms can show messages. */
export type FormState = {
  status: "idle" | "error" | "success";
  message?: string;
  /** Per-field error messages, keyed by input name. */
  fieldErrors?: Record<string, string>;
  /**
   * What the person typed, sent back on errors so the form can refill
   * itself (React clears forms after they're submitted). Never passwords.
   */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };
