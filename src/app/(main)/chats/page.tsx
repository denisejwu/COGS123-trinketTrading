import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftRight, MessageCircle, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CommunityCover } from "@/components/communities/CommunityCover";
import { EmptyState } from "@/components/ui/EmptyState";
import { requireProfile } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chats" };

type Thread = {
  id: string;
  user_a: string;
  last_message: string | null;
  last_message_at: string | null;
  user_a_last_read: string | null;
  user_b_last_read: string | null;
  a: { username: string; display_name: string; avatar_path: string | null };
  b: { username: string; display_name: string; avatar_path: string | null };
};

/** All your conversations: direct messages, room chats, and where trade chats live. */
export default async function ChatsPage() {
  const me = await requireProfile();
  const supabase = await createClient();

  const [{ data: threadRows }, { data: memberships }] = await Promise.all([
    supabase
      .from("direct_threads")
      .select(
        `id, user_a, last_message, last_message_at, user_a_last_read, user_b_last_read,
         a:profiles!direct_threads_user_a_fkey ( username, display_name, avatar_path ),
         b:profiles!direct_threads_user_b_fkey ( username, display_name, avatar_path )`,
      )
      .not("last_message_at", "is", null)
      .order("last_message_at", { ascending: false })
      .limit(50),
    supabase
      .from("community_members")
      .select("community:communities ( id, slug, name, cover_path )")
      .eq("user_id", me.id)
      .order("joined_at", { ascending: false }),
  ]);

  const threads = (threadRows ?? []) as unknown as Thread[];
  const rooms = (memberships ?? []).map((m) => m.community).filter(Boolean) as unknown as {
    id: string;
    slug: string;
    name: string;
    cover_path: string | null;
  }[];

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <h1 className="text-2xl font-extrabold md:text-3xl">Chats</h1>

      <section aria-labelledby="dm-heading" className="space-y-3">
        <div>
          <h2 id="dm-heading" className="flex items-center gap-2 text-lg font-extrabold">
            <MessageCircle aria-hidden="true" size={20} />
            Direct messages
          </h2>
          <p className="text-sm text-muted">Start one with the Message button on anyone&apos;s profile or listing.</p>
        </div>
        {threads.length === 0 ? (
          <EmptyState icon={<MessageCircle size={22} />} title="No messages yet">
            Find someone in a community and tap “Message” on their profile.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {threads.map((t) => {
              const iAmA = t.user_a === me.id;
              const other = iAmA ? t.b : t.a;
              const myRead = iAmA ? t.user_a_last_read : t.user_b_last_read;
              const unread = Boolean(t.last_message_at && (!myRead || t.last_message_at > myRead));
              return (
                <li key={t.id}>
                  <Link
                    href={`/chats/${t.id}`}
                    className={`flex items-center gap-3 rounded-3xl border bg-card p-3 hover:shadow-md ${unread ? "border-accent" : "border-line"}`}
                  >
                    <Avatar path={other.avatar_path} name={other.display_name} size={44} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-extrabold">{other.display_name}</span>
                      <span className={`block truncate text-sm ${unread ? "font-bold text-navy" : "text-muted"}`}>
                        {t.last_message}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-xs text-muted">
                      {t.last_message_at && timeAgo(t.last_message_at)}
                      {unread && <span className="mt-1 block font-bold text-accent">New</span>}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section aria-labelledby="rooms-heading" className="space-y-3">
        <h2 id="rooms-heading" className="flex items-center gap-2 text-lg font-extrabold">
          <Users aria-hidden="true" size={20} />
          Room chats
        </h2>
        {rooms.length === 0 ? (
          <p className="text-sm text-muted">Join a community to chat with everyone in it.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {rooms.map((room) => (
              <li key={room.id}>
                <Link
                  href={`/c/${room.slug}?tab=chat`}
                  className="flex items-center gap-3 overflow-hidden rounded-3xl border border-line bg-card pr-3 hover:shadow-md"
                >
                  <CommunityCover slug={room.slug} coverPath={room.cover_path} className="h-14 w-14 shrink-0" iconSize={22} />
                  <span className="font-bold">{room.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex items-center gap-3 rounded-3xl bg-accent-soft p-4 text-sm">
        <ArrowLeftRight aria-hidden="true" size={20} className="shrink-0 text-accent" />
        <p>
          Chats about a specific trade live inside each offer.{" "}
          <Link href="/offers" className="font-bold text-accent hover:underline">
            Go to your offers
          </Link>
        </p>
      </section>
    </div>
  );
}
