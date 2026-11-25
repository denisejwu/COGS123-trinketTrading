import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireProfile } from "@/lib/auth";
import { LISTING_CARD_SELECT, type ListingCardData } from "@/lib/listings";
import { getSocialContext } from "@/lib/social";
import { createClient } from "@/lib/supabase/server";
import { parseProfileTab, ProfileView, type ProfileReview } from "./ProfileView";

async function getProfile(username: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();
  return data;
}

export async function generateMetadata({
  params,
}: PageProps<"/u/[username]">): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfile(username);
  return { title: profile ? `${profile.display_name} (@${profile.username})` : "Profile not found" };
}

export default async function ProfilePage({ params, searchParams }: PageProps<"/u/[username]">) {
  const { username } = await params;
  const { tab } = await searchParams;

  const [profile, me] = await Promise.all([getProfile(username), requireProfile()]);
  if (!profile) notFound();

  const supabase = await createClient();
  const [{ data: listingRows, error }, { data: reviewRows }, social] = await Promise.all([
    // Everything they currently own that isn't traded away.
    supabase
      .from("listings")
      .select(LISTING_CARD_SELECT)
      .eq("owner_id", profile.id)
      .neq("status", "traded")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase
      .from("reviews")
      .select("id, rating, tags, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey ( username, display_name, avatar_path )")
      .eq("reviewee_id", profile.id)
      .order("created_at", { ascending: false })
      .limit(50),
    getSocialContext(profile.id, profile.location, me),
  ]);
  if (error) throw new Error(`Couldn't load listings: ${error.message}`);
  const listings = (listingRows ?? []) as unknown as ListingCardData[];

  return (
    <ProfileView
      profile={profile}
      isMe={profile.id === me.id}
      activeTab={parseProfileTab(tab)}
      basePath={`/u/${profile.username}`}
      forTrade={listings.filter((l) => l.for_trade)}
      showcase={listings.filter((l) => !l.for_trade)}
      reviews={(reviewRows ?? []) as unknown as ProfileReview[]}
      social={social}
    />
  );
}
