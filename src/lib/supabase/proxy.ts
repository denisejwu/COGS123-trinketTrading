import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasSupabaseEnv, supabaseEnv } from "./env";
import { sessionOnly } from "./session-cookie";

// Pages you can visit without being logged in.
const PUBLIC_PREFIXES = ["/login", "/auth", "/join"];
// Pages a logged-in user has no reason to see (we send them home instead).
const LOGGED_OUT_ONLY = ["/login"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

/** Redirect while keeping any refreshed login cookies we just set. */
function redirectKeepingCookies(url: URL, from: NextResponse) {
  const redirect = NextResponse.redirect(url);
  from.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

/**
 * Runs before every page request (called from src/proxy.ts):
 *  1. refreshes the Supabase login session if it's about to expire
 *  2. sends logged-out visitors to /login
 *  3. sends logged-in users away from /login
 */
export async function updateSession(request: NextRequest) {
  // Without settings we can't check logins. Send everyone to the welcome
  // page, which explains which settings are missing (instead of a crash).
  if (!hasSupabaseEnv()) {
    if (isPublic(request.nextUrl.pathname)) return NextResponse.next({ request });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    return NextResponse.redirect(loginUrl);
  }

  const { url, key } = supabaseEnv();
  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        // Put refreshed cookies on the request (so the page sees them)...
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        // ...and on the response (so the browser stores them).
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, sessionOnly(options)),
        );
        // Headers that stop CDNs from caching a response containing a session.
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });

  // IMPORTANT: keep this call right after createServerClient. It verifies the
  // session and refreshes it if needed.
  const { data } = await supabase.auth.getClaims();
  const isLoggedIn = Boolean(data?.claims?.sub);
  const { pathname, search } = request.nextUrl;

  if (!isLoggedIn && !isPublic(pathname)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname + search);
    return redirectKeepingCookies(loginUrl, response);
  }

  if (isLoggedIn && LOGGED_OUT_ONLY.includes(pathname)) {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return redirectKeepingCookies(homeUrl, response);
  }

  return response;
}
