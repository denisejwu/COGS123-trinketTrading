import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Plus, QrCode } from "lucide-react";
import { StarterPackCard } from "@/components/StarterPackCard";
import { CommunityCover } from "@/components/communities/CommunityCover";
import { LinkTabs } from "@/components/ui/LinkTabs";
import { Notice } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { buttonClasses } from "@/components/ui/button";
import { requireProfile } from "@/lib/auth";
import { plural } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { joinCommunity, leaveCommunity } from "./actions";
import { CommunityEvents } from "./CommunityEvents";
import { CommunityListings } from "./CommunityListings";
import { Discussion } from "./Discussion";
import { RoomChat } from "./RoomChat";

const TABS = {
  listings: { label: "Listings", hint: "Items members are trading or showing off here." },
  chat: { label: "Room chat", hint: "Live chat with everyone in this community, right now." },
  discussion: { label: "Discussion", hint: "Questions, wishlists and meetup ideas for the whole community." },
  events: { label: "Events", hint: "Swap meets and get-togethers for this community." },
} as const;
type TabKey = keyof typeof TABS;

async function getCommunity(slug: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("communities")
    .select(
      "id, slug, name, description, cover_path, created_by, " +
        "creator:profiles!communities_created_by_fkey ( username, display_name ), " +
        "community_members ( count )",
    )
    .eq("slug", slug)
    .maybeSingle();
  return data as unknown as {
    id: string;
    slug: string;
    name: string;
    description: string;
    cover_path: string | null;
    creator: { username: string; display_name: string } | null;
    community_members: { count: number }[];
  } | null;
}

export async function generateMetadata({ params }: PageProps<"/c/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const community = await getCommunity(slug);
  return { title: community?.name ?? "Community not found" };
}

export default async function CommunityPage({ params, searchParams }: PageProps<"/c/[slug]">) {
  const { slug } = await params;
  const sp = await searchParams;
  const tab: TabKey = typeof sp.tab === "string" && sp.tab in TABS ? (sp.tab as TabKey) : "listings";

  const [community, me] = await Promise.all([getCommunity(slug), requireProfile()]);
  if (!community) notFound();

  const supabase = await createClient();
  const { data: membership } = await supabase
    .from("community_members")
    .select("user_id")
    .eq("community_id", community.id)
    .eq("user_id", me.id)
    .maybeSingle();
  const isMember = Boolean(membership);
  const memberCount = community.community_members[0]?.count ?? 0;

  return (
    <div className="space-y-6">
      {/* ---------- Header ---------- */}
      <section className="overflow-hidden rounded-3xl border border-line bg-card">
        <CommunityCover slug={community.slug} coverPath={community.cover_path} className="h-32 md:h-44" iconSize={56} />
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-extrabold md:text-3xl">{community.name}</h1>
            <p className="max-w-prose text-muted">{community.description}</p>
            <p className="text-sm text-muted">
              {plural(memberCount, "member")} ·{" "}
              {community.creator ? (
                <>
                  Started by{" "}
                  <Link href={`/u/${community.creator.username}`} className="font-bold text-accent hover:underline">
                    {community.creator.display_name}
                  </Link>
                </>
              ) : (
                "A PopSwap starter community"
              )}
            </p>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            <form action={isMember ? leaveCommunity : joinCommunity}>
              <input type="hidden" name="community_id" value={community.id} />
              <input type="hidden" name="slug" value={community.slug} />
              <SubmitButton variant={isMember ? "secondary" : "primary"} pendingText={isMember ? "Leaving…" : "Joining…"}>
                {isMember ? "Leave" : "Join community"}
              </SubmitButton>
            </form>
            <Link href={`/listings/new?community=${community.slug}`} className={buttonClasses("secondary")}>
              <Plus aria-hidden="true" size={18} />
              Post here
            </Link>
            <Link href={`/c/${community.slug}/present`} className={buttonClasses("secondary")}>
              <QrCode aria-hidden="true" size={18} />
              Invite (QR)
            </Link>
          </div>
        </div>
      </section>

      {sp.welcome === "1" && isMember && (
        <Notice tone="success">
          Welcome to {community.name}, {me.display_name}!{" "}
          {me.starter_pack_claimed_at
            ? "Check the Events tab and say hi in the room chat."
            : "Open your starter pack below to get trinkets to trade."}
        </Notice>
      )}

      {isMember && !me.starter_pack_claimed_at && (
        <StarterPackCard communityId={community.id} communityName={community.name} />
      )}

      {/* ---------- Tabs ---------- */}
      <div className="space-y-2">
        <LinkTabs
          label="Community sections"
          active={tab}
          tabs={(Object.keys(TABS) as TabKey[]).map((key) => ({
            key,
            label: TABS[key].label,
            href: `/c/${community.slug}?tab=${key}`,
          }))}
        />
        <p className="text-sm text-muted">{TABS[tab].hint}</p>
      </div>

      {tab === "listings" && (
        <CommunityListings
          communityId={community.id}
          communitySlug={community.slug}
          myLocation={me.location}
          searchParams={sp}
        />
      )}
      {tab === "chat" && (
        <RoomChat communityId={community.id} communityName={community.name} isMember={isMember} me={me} />
      )}
      {tab === "discussion" && (
        <Discussion
          communityId={community.id}
          communitySlug={community.slug}
          isMember={isMember}
          myId={me.id}
        />
      )}
      {tab === "events" && (
        <CommunityEvents communityId={community.id} communitySlug={community.slug} isMember={isMember} />
      )}
    </div>
  );
}
