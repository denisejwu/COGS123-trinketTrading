import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";
import { sessionOnly } from "./session-cookie";

/**
 * Supabase client for code that runs on the SERVER: Server Components,
 * Server Actions and Route Handlers. It reads the login session from the
 * request's cookies, so every query runs as the logged-in user and Row
 * Level Security applies.
 *
 * Create a new one per request (don't store it in a global variable).
 */
export async function createClient() {
  const cookieStore = await cookies();
  const { url, key } = supabaseEnv();

  return createServerClient<Database>(url, key, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, sessionOnly(options)),
          );
        } catch {
          // Server Components aren't allowed to set cookies. That's OK:
          // src/proxy.ts refreshes the session cookie on every request.
        }
      },
    },
  });
}
