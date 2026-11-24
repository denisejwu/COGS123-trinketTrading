import { createBrowserClient, parseCookieHeader, serializeCookieHeader } from "@supabase/ssr";
import type { Database } from "@/lib/database.types";
import { supabaseEnv } from "./env";
import { sessionOnly } from "./session-cookie";

/**
 * Supabase client for code that runs in the BROWSER ("use client" components).
 * Use it for things that must happen client-side: uploading photos straight
 * to Storage and listening to Realtime chat messages.
 *
 * We read and write the login cookies ourselves so that, like on the server,
 * they last only until the browser is closed (see session-cookie.ts).
 */
export function createClient() {
  const { url, key } = supabaseEnv();
  return createBrowserClient<Database>(url, key, {
    cookies: {
      getAll() {
        return parseCookieHeader(document.cookie).map(({ name, value }) => ({ name, value: value ?? "" }));
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          document.cookie = serializeCookieHeader(name, value, sessionOnly(options));
        });
      },
    },
  });
}
