"use server";

/**
 * Server side of the QR "join a room" flow.
 *
 * The name-only sign-in itself happens in the browser (src/lib/sign-in.ts),
 * so each phone counts separately against Supabase's per-network limit.
 * By the time this runs, the person is logged in; we add them to the
 * community (the room) and take them inside.
 */
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function joinRoom(slug: string): Promise<{ message: string } | void> {
  const supabase = await createClient();

  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return { message: "Please enter your name first." };

  const { data: community } = await supabase.from("communities").select("id").eq("slug", slug).maybeSingle();
  if (!community) return { message: "This room doesn't exist any more." };

  const { error } = await supabase
    .from("community_members")
    .upsert({ community_id: community.id, user_id: userId }, { ignoreDuplicates: true });
  if (error) return { message: `Couldn't join: ${error.message}` };

  revalidatePath("/", "layout");
  redirect(`/c/${slug}?welcome=1`);
}
