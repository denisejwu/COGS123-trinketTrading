/**
 * Reads the Supabase settings from environment variables (.env.local).
 *
 * Both values start with NEXT_PUBLIC_, which means they are sent to the
 * browser. That's expected: the publishable key can only do what Row Level
 * Security policies allow, so it is safe to expose.
 */
export function supabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    throw new Error(
      "Missing Supabase settings. Copy .env.example to .env.local, fill in " +
        "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, " +
        "then restart `npm run dev`.",
    );
  }
  return { url, key };
}

export function hasSupabaseEnv() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );
}
