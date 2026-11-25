import "server-only";
import { createClient } from "@/lib/supabase/server";

export type SocialContext = {
  /** How many people this person has added as friends. */
  friendCount: number;
  /** Have I added them? */
  isFriend: boolean;
  /** People we've BOTH added (first few, for display). */
  mutual: { username: string; display_name: string; avatar_path: string | null }[];
  mutualCount: number;
  /** Same school/city as me (ignoring capital letters). */
  sameSchool: boolean;
};

/** Friends, mutual friends and school match between me and someone else. */
export async function getSocialContext(
  personId: string,
  personLocation: string | null,
  me: { id: string; location: string | null },
): Promise<SocialContext> {
  const supabase = await createClient();
  const [{ data: theirFriends }, { data: myFriends }] = await Promise.all([
    supabase.from("friends").select("friend_id").eq("user_id", personId),
    supabase.from("friends").select("friend_id").eq("user_id", me.id),
  ]);

  const mine = new Set((myFriends ?? []).map((f) => f.friend_id));
  const mutualIds = (theirFriends ?? [])
    .map((f) => f.friend_id)
    .filter((id) => mine.has(id) && id !== me.id && id !== personId);

  const { data: mutual } = mutualIds.length
    ? await supabase.from("profiles").select("username, display_name, avatar_path").in("id", mutualIds.slice(0, 3))
    : { data: [] };

  const norm = (s: string | null) => (s ?? "").trim().toLowerCase();
  return {
    friendCount: theirFriends?.length ?? 0,
    isFriend: mine.has(personId),
    mutual: mutual ?? [],
    mutualCount: mutualIds.length,
    sameSchool: personId !== me.id && norm(personLocation) !== "" && norm(personLocation) === norm(me.location),
  };
}
