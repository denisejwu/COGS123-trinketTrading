import { NextResponse, type NextRequest } from "next/server";
import { UUID_PATTERN } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";
import { safeNextPath } from "@/lib/validation";

/** Opening a notification: mark it read, then go where it points. */
export async function GET(request: NextRequest, { params }: RouteContext<"/notifications/[id]">) {
  const { id } = await params;
  const home = new URL("/notifications", request.url);
  if (!UUID_PATTERN.test(id)) return NextResponse.redirect(home);

  const supabase = await createClient();
  // Security rules only find (and update) your own notifications.
  const { data } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id)
    .select("link")
    .maybeSingle();

  return NextResponse.redirect(new URL(safeNextPath(data?.link, "/notifications"), request.url));
}
