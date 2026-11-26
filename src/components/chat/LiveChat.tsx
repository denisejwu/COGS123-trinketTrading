"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { LocalTime } from "@/components/LocalTime";
import { buttonClasses } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

export type ChatPerson = { id: string; username: string; display_name: string; avatar_path: string | null };
export type ChatLine = { id: string; sender_id: string; body: string; created_at: string };

type Scope = { kind: "room"; communityId: string } | { kind: "direct"; threadId: string };

/**
 * A live chat used for room chats (everyone in a community) and direct
 * messages. New messages arrive instantly through Supabase Realtime; the
 * security rules make sure only the right people receive them.
 */
export function LiveChat({
  scope,
  me,
  initialPeople,
  initialMessages,
  title,
  emptyText,
  canSend = true,
}: {
  scope: Scope;
  me: ChatPerson;
  initialPeople: ChatPerson[];
  initialMessages: ChatLine[];
  title: string;
  emptyText: string;
  canSend?: boolean;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [live, setLive] = useState<ChatLine[]>([]);
  const [people, setPeople] = useState<Record<string, ChatPerson>>(() =>
    Object.fromEntries([me, ...initialPeople].map((p) => [p.id, p])),
  );
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  // The live listener reads the latest `people` through this ref.
  const peopleRef = useRef(people);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // Plain values (not the `scope` object) so the listener isn't recreated
  // on every render.
  const scopeKind = scope.kind;
  const scopeId = scope.kind === "room" ? scope.communityId : scope.threadId;

  const messages = useMemo(() => {
    const ids = new Set(initialMessages.map((m) => m.id));
    return [...initialMessages, ...live.filter((m) => !ids.has(m.id))].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  }, [initialMessages, live]);

  const table = scopeKind === "room" ? "room_messages" : "direct_messages";
  const filter = scopeKind === "room" ? `community_id=eq.${scopeId}` : `thread_id=eq.${scopeId}`;
  const channelName = scopeKind === "room" ? `room-chat-${scopeId}` : `dm-${scopeId}`;

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(channelName)
        .on("postgres_changes", { event: "INSERT", schema: "public", table, filter }, async (payload) => {
          const message = payload.new as ChatLine;
          setLive((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));

          // Someone new spoke in the room: look up their name and picture.
          if (!peopleRef.current[message.sender_id]) {
            const { data } = await supabase
              .from("profiles")
              .select("id, username, display_name, avatar_path")
              .eq("id", message.sender_id)
              .maybeSingle();
            if (data) setPeople((current) => ({ ...current, [data.id]: data }));
          }
          // Reading a DM as it arrives counts as having read it.
          if (scopeKind === "direct" && message.sender_id !== me.id) {
            void supabase.rpc("mark_thread_read", { p_thread_id: scopeId });
          }
        })
        .subscribe();
    })();

    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [supabase, channelName, table, filter, scopeKind, scopeId, me.id]);

  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length]);

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);

    const query =
      scope.kind === "room"
        ? supabase.from("room_messages").insert({ community_id: scope.communityId, sender_id: me.id, body })
        : supabase.from("direct_messages").insert({ thread_id: scope.threadId, sender_id: me.id, body });
    const { data, error: insertError } = await query.select("id, sender_id, body, created_at").single();

    if (insertError) setError("Couldn't send your message. Please try again.");
    else if (data) {
      setText("");
      setLive((current) => (current.some((m) => m.id === data.id) ? current : [...current, data]));
    }
    setSending(false);
  }

  const showNames = scope.kind === "room";

  return (
    <section aria-label={title} className="flex h-[min(36rem,75vh)] flex-col rounded-3xl border border-line bg-card">
      <header className="border-b border-line px-4 py-3">
        <h2 className="font-extrabold">{title}</h2>
      </header>

      <ol ref={listRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.length === 0 && <li className="py-8 text-center text-sm text-muted">{emptyText}</li>}
        {messages.map((message) => {
          const mine = message.sender_id === me.id;
          const author = people[message.sender_id];
          return (
            <li key={message.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && (
                <Link href={author ? `/u/${author.username}` : "#"} aria-label={author?.display_name ?? "Someone"}>
                  <Avatar path={author?.avatar_path ?? null} name={author?.display_name ?? "?"} size={28} />
                </Link>
              )}
              <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-accent text-white" : "bg-cream text-navy"}`}>
                {showNames && !mine && <p className="text-[11px] font-extrabold text-accent">{author?.display_name ?? "…"}</p>}
                <p className="whitespace-pre-line break-words">{message.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine ? "text-white/80" : "text-muted"}`}>
                  <LocalTime iso={message.created_at} style="time" />
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {canSend ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
          <label htmlFor={`chat-${channelName}`} className="sr-only">
            Write a message
          </label>
          <textarea
            id={`chat-${channelName}`}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send(e);
              }
            }}
            rows={1}
            maxLength={1000}
            placeholder="Write a message…"
            className="max-h-32 min-h-11 flex-1 resize-y rounded-2xl border border-line bg-card px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <button
            type="submit"
            disabled={sending || !text.trim()}
            aria-label="Send message"
            className={buttonClasses("primary", "h-11 w-11 !px-0")}
          >
            <Send aria-hidden="true" size={18} />
          </button>
        </form>
      ) : null}
      {error && (
        <p role="alert" className="px-3 pb-3 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
