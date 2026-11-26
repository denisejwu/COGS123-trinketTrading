import { LiveChat, type ChatLine, type ChatPerson } from "@/components/chat/LiveChat";
import { Notice } from "@/components/ui/Notice";
import type { Profile } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";

/** The community's live group chat (last 100 messages, then live). */
export async function RoomChat({
  communityId,
  communityName,
  isMember,
  me,
}: {
  communityId: string;
  communityName: string;
  isMember: boolean;
  me: Profile;
}) {
  if (!isMember) {
    return <Notice tone="info">Join {communityName} to read and send messages in the room chat.</Notice>;
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from("room_messages")
    .select("id, sender_id, body, created_at, sender:profiles!room_messages_sender_id_fkey ( id, username, display_name, avatar_path )")
    .eq("community_id", communityId)
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as unknown as (ChatLine & { sender: ChatPerson })[];
  const people = new Map(rows.map((r) => [r.sender.id, r.sender]));

  return (
    <LiveChat
      scope={{ kind: "room", communityId }}
      me={{ id: me.id, username: me.username, display_name: me.display_name, avatar_path: me.avatar_path }}
      initialPeople={[...people.values()]}
      initialMessages={rows.map(({ id, sender_id, body, created_at }) => ({ id, sender_id, body, created_at })).reverse()}
      title={`${communityName} room chat`}
      emptyText="No messages yet. Say hi to everyone!"
    />
  );
}
