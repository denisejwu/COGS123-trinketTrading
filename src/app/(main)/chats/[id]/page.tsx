import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { TraderBadge } from "@/components/TraderBadge";
import { LiveChat, type ChatPerson } from "@/components/chat/LiveChat";
import { requireProfile } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Messages" };

const PERSON = "id, username, display_name, avatar_path, trades_completed, rating_avg, rating_count, is_demo, trader_level";

/** A 1-on-1 conversation. Opening it marks it as read. */
export default async function DirectChatPage({ params }: PageProps<"/chats/[id]">) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  const me = await requireProfile();
  const supabase = await createClient();

  // Security rules only return threads you're part of.
  const { data: thread } = await supabase
    .from("direct_threads")
    .select(`id, user_a, a:profiles!direct_threads_user_a_fkey ( ${PERSON} ), b:profiles!direct_threads_user_b_fkey ( ${PERSON} )`)
    .eq("id", id)
    .maybeSingle();
  if (!thread) notFound();

  const [{ data: messages }] = await Promise.all([
    supabase
      .from("direct_messages")
      .select("id, sender_id, body, created_at")
      .eq("thread_id", id)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase.rpc("mark_thread_read", { p_thread_id: id }),
  ]);

  type Person = ChatPerson & {
    trades_completed: number;
    rating_avg: number | null;
    rating_count: number;
    is_demo: boolean;
    trader_level: string;
  };
  const a = thread.a as unknown as Person;
  const b = thread.b as unknown as Person;
  const other = thread.user_a === me.id ? b : a;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Link href="/chats" className="text-sm font-bold text-accent hover:underline">
        ← All chats
      </Link>
      <Link href={`/u/${other.username}`} className="flex items-center gap-3 rounded-3xl border border-line bg-card p-4 hover:shadow-md">
        <Avatar path={other.avatar_path} name={other.display_name} size={48} />
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-extrabold">{other.display_name}</span>
          <TraderBadge tradesCompleted={other.trades_completed} ratingAvg={other.rating_avg} ratingCount={other.rating_count}
              isDemo={other.is_demo}
              level={other.trader_level} />
        </span>
      </Link>
      <LiveChat
        scope={{ kind: "direct", threadId: id }}
        me={{ id: me.id, username: me.username, display_name: me.display_name, avatar_path: me.avatar_path }}
        initialPeople={[other]}
        initialMessages={(messages ?? []).reverse()}
        title={`Chat with ${other.display_name}`}
        emptyText={`Say hi to ${other.display_name}!`}
      />
    </div>
  );
}
