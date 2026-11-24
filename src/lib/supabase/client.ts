import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";

/**
 * Supabase client for code that runs in the BROWSER ("use client" components).
 * Use it for things that must happen client-side: uploading photos straight
 * to Storage and listening to Realtime chat messages.
 */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key);
}
