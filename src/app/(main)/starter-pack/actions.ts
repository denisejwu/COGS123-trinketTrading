"use server";

import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ListingRarity } from "@/lib/types";

export type PackItem = { id: string; title: string; rarity: ListingRarity; image: string | null; goal: string | null };

/**
 * Opens your one-time starter pack: 4 random virtual trinkets go into the
 * given community (the database function picks them; see 0006).
 * We don't refresh the page here, so the reveal animation can play first.
 */
export async function openStarterPack(communityId: string): Promise<{ error?: string; items?: PackItem[] }> {
  await requireUserId();
  const supabase = await createClient();

  const { data: ids, error } = await supabase.rpc("claim_starter_pack", { p_community_id: communityId });
  if (error || !ids) return { error: error?.message ?? "Couldn't open the pack." };

  const { data } = await supabase
    .from("listings")
    .select("id, title, rarity, looking_for, listing_images ( path )")
    .in("id", ids);

  const byId = new Map((data ?? []).map((l) => [l.id, l]));
  return {
    items: ids.flatMap((id) => {
      const l = byId.get(id);
      return l
        ? [{ id: l.id, title: l.title, rarity: l.rarity, image: l.listing_images[0]?.path ?? null, goal: l.looking_for }]
        : [];
    }),
  };
}
