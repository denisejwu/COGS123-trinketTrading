import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Search, Users } from "lucide-react";
import { CommunityCard, type CommunityCardData } from "@/components/communities/CommunityCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth";
import { escapeLike } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Communities" };

export default async function CommunitiesPage({ searchParams }: PageProps<"/communities">) {
  const { q } = await searchParams;
  const search = typeof q === "string" ? q.trim() : "";

  const userId = await requireUserId();
  const supabase = await createClient();

  // `community_members(count)` asks Supabase to count each community's members.
  let query = supabase
    .from("communities")
    .select("id, slug, name, description, cover_path, community_members(count)");
  if (search) query = query.ilike("name", `%${escapeLike(search)}%`);

  const [{ data, error }, { data: memberships }] = await Promise.all([
    query,
    supabase.from("community_members").select("community_id").eq("user_id", userId),
  ]);
  if (error) throw new Error(`Couldn't load communities: ${error.message}`);

  const joined = new Set((memberships ?? []).map((m) => m.community_id));
  const communities: CommunityCardData[] = (data ?? [])
    .map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      description: c.description,
      cover_path: c.cover_path,
      memberCount: c.community_members[0]?.count ?? 0,
      isMember: joined.has(c.id),
    }))
    // Your communities first, then the biggest ones.
    .sort(
      (a, b) =>
        Number(b.isMember) - Number(a.isMember) ||
        b.memberCount - a.memberCount ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Communities</h1>
          <p className="text-muted">Groups for each kind of collectible. Join the ones you collect.</p>
        </div>
        <Link href="/communities/new" className={buttonClasses("secondary")}>
          <Plus aria-hidden="true" size={18} />
          Start a community
        </Link>
      </div>

      {/* A plain GET form: searching just changes the URL to ?q=... */}
      <form role="search" className="flex gap-2">
        <label htmlFor="community-search" className="sr-only">
          Search communities
        </label>
        <div className="relative flex-1">
          <Search aria-hidden="true" size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
          <input
            id="community-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Search communities, e.g. pins"
            className="w-full rounded-full border border-line bg-card py-2.5 pl-11 pr-4 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <button type="submit" className={buttonClasses("primary")}>
          Search
        </button>
      </form>

      {communities.length === 0 ? (
        <EmptyState
          icon={<Users size={22} />}
          title={search ? `No communities match “${search}”` : "No communities yet"}
          action={
            <Link href="/communities/new" className={buttonClasses("primary")}>
              Start one
            </Link>
          }
        >
          {search ? "Try a different word, or start a new community for it." : "Be the first to start one."}
        </EmptyState>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {communities.map((community) => (
            <li key={community.id}>
              <CommunityCard community={community} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
