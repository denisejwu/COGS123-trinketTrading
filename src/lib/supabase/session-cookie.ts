import type { CookieOptions } from "@supabase/ssr";

/**
 * Prototype rule: a login lasts only for the current browser session.
 *
 * Supabase normally saves its login cookies for 400 days. We remove that
 * lifetime, which turns them into "session cookies": they survive page
 * refreshes and new tabs, but the browser deletes them when it's closed.
 * Because name-only accounts have no password, that account can't be
 * opened again afterwards.
 *
 * Deleting a cookie works by setting maxAge to 0, so we leave those alone.
 */
export function sessionOnly(options: CookieOptions = {}): CookieOptions {
  if (options.maxAge === 0) return options;
  const rest = { ...options };
  delete rest.maxAge;
  delete rest.expires;
  return rest;
}
