import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { parseProfileTab, ProfileView } from "./ProfileView";

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

  const [profile, myId] = await Promise.all([getProfile(username), getUserId()]);
  if (!profile) notFound();

  return (
    <ProfileView
      profile={profile}
      isMe={profile.id === myId}
      activeTab={parseProfileTab(tab)}
      basePath={`/u/${profile.username}`}
    />
  );
}
