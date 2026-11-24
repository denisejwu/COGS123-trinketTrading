import { NextResponse, type NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Log out. Used by <form action="/auth/signout" method="post"> buttons.
 * It's a POST (not a link) so a random website can't log you out by
 * embedding the URL.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  // 303 tells the browser to follow the redirect with a normal GET.
  return NextResponse.redirect(new URL("/login?message=signed-out", request.url), {
    status: 303,
  });
}
