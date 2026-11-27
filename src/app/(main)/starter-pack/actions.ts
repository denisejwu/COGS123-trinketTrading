"use server";

import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { ListingRarity } from "@/lib/types";

export type PackItem = { id: string; title: string; rarity: ListingRarity; image: string | null; goal: string | null };

/** Everything the pack reveal shows. */
export type PackResult = {
  error?: string;
  items?: PackItem[];
  /** "new" or "experienced" (about 1 in 3 people start experienced). */
  level?: string;
  tradesCompleted?: number;
  /** The welcome offer a practice trader sent you, if any. */
  welcome?: { offerId: string; from: string; avatar: string | null } | null;
};

/**
 * Opens your one-time starter pack: 4 random virtual trinkets go into the
 * given community, you get a trader level, and a practice trader sends you
 * a welcome offer (the database function does it all; see 0006 and 0009).
 * We don't refresh the page here, so the reveal animation can play first.
 */
export async function openStarterPack(communityId: string): Promise<PackResult> {
  const userId = await requireUserId();
  const supabase = await createClient();

  const { data: ids, error } = await supabase.rpc("claim_starter_pack", { p_community_id: communityId });
  if (error || !ids) return { error: error?.message ?? "Couldn't open the pack." };

  const [{ data }, { data: profile }, { data: welcome }] = await Promise.all([
    supabase.from("listings").select("id, title, rarity, looking_for, listing_images ( path )").in("id", ids),
    supabase.from("profiles").select("trader_level, trades_completed").eq("id", userId).single(),
    supabase
      .from("offers")
      .select("id, sender:profiles!offers_sender_id_fkey ( display_name, avatar_path )")
      .eq("recipient_id", userId)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  const sender = welcome?.sender as unknown as { display_name: string; avatar_path: string | null } | null;

  const byId = new Map((data ?? []).map((l) => [l.id, l]));
  return {
    level: profile?.trader_level ?? "new",
    tradesCompleted: profile?.trades_completed ?? 0,
    welcome: welcome && sender ? { offerId: welcome.id, from: sender.display_name, avatar: sender.avatar_path } : null,
    items: ids.flatMap((id) => {
      const l = byId.get(id);
      return l
        ? [{ id: l.id, title: l.title, rarity: l.rarity, image: l.listing_images[0]?.path ?? null, goal: l.looking_for }]
        : [];
    }),
  };
}
