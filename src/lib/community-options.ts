import "server-only";
import { createClient } from "@/lib/supabase/server";

/** All communities for the listing form's dropdown, marking the ones you've joined. */
export async function getCommunityOptions(userId: string) {
  const supabase = await createClient();
  const [{ data: communities, error }, { data: memberships }] = await Promise.all([
    supabase.from("communities").select("id, slug, name").order("name"),
    supabase.from("community_members").select("community_id").eq("user_id", userId),
  ]);
  if (error) throw new Error(`Couldn't load communities: ${error.message}`);

  const joined = new Set((memberships ?? []).map((m) => m.community_id));
  return (communities ?? []).map((c) => ({ id: c.id, slug: c.slug, name: c.name, joined: joined.has(c.id) }));
}
