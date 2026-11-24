"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { Send } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { buttonClasses } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/negotiations";
import { createClient } from "@/lib/supabase/client";

type Person = { id: string; display_name: string; avatar_path: string | null };

const MESSAGE_COLUMNS = "id, offer_id, sender_id, kind, body, round_id, created_at";

/**
 * Real-time chat for a negotiation / trade.
 *  - New messages arrive instantly through Supabase Realtime (the security
 *    rules make sure only the two people in the trade receive them).
 *  - "Maya is typing…" uses a Realtime broadcast (nothing is saved).
 *  - When a proposal or status message arrives, the page reloads its data
 *    so the proposal card and buttons are up to date.
 */
export function TradeChat({
  offerId,
  me,
  other,
  initialMessages,
  canSend,
}: {
  offerId: string;
  me: Person;
  other: Person;
  initialMessages: ChatMessage[];
  canSend: boolean;
}) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  // Messages that arrived live (or that we just sent) since the page loaded.
  const [liveMessages, setLiveMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [otherTyping, setOtherTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const listRef = useRef<HTMLOListElement>(null);
  const lastTypingSent = useRef(0);

  // Everything to show = messages from the server + live ones not in that list yet.
  // (After router.refresh() the server list includes them, so we skip duplicates.)
  const messages = useMemo(() => {
    const ids = new Set(initialMessages.map((m) => m.id));
    return [...initialMessages, ...liveMessages.filter((m) => !ids.has(m.id))].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    );
  }, [initialMessages, liveMessages]);

  const addLive = (message: ChatMessage) =>
    setLiveMessages((current) => (current.some((m) => m.id === message.id) ? current : [...current, message]));

  // Subscribe to new messages + typing events for this negotiation.
  useEffect(() => {
    let typingTimer: ReturnType<typeof setTimeout> | undefined;
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    (async () => {
      // Make sure Realtime uses our login, so security rules let messages through.
      await supabase.realtime.setAuth();
      if (cancelled) return;

      channel = supabase
        .channel(`offer-${offerId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "trade_messages", filter: `offer_id=eq.${offerId}` },
          (payload) => {
            const message = payload.new as ChatMessage;
            addLive(message);
            if (message.sender_id === other.id) setOtherTyping(false);
            // Proposals and status changes affect the rest of the page.
            if (message.kind !== "text") router.refresh();
          },
        )
        .on("broadcast", { event: "typing" }, ({ payload }) => {
          if (payload?.userId !== other.id) return;
          setOtherTyping(true);
          clearTimeout(typingTimer);
          typingTimer = setTimeout(() => setOtherTyping(false), 3000);
        })
        .subscribe();
      channelRef.current = channel;
    })();

    return () => {
      cancelled = true;
      clearTimeout(typingTimer);
      if (channel) void supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [offerId, other.id, router, supabase]);

  // Scroll to the newest message.
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages.length, otherTyping]);

  function handleTyping(value: string) {
    setText(value);
    const now = Date.now();
    if (now - lastTypingSent.current > 2000 && channelRef.current) {
      lastTypingSent.current = now;
      void channelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: me.id } });
    }
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);

    const { data, error: insertError } = await supabase
      .from("trade_messages")
      .insert({ offer_id: offerId, sender_id: me.id, body })
      .select(MESSAGE_COLUMNS)
      .single();

    if (insertError) {
      setError("Couldn't send your message. Please try again.");
    } else if (data) {
      setText("");
      addLive(data as ChatMessage);
    }
    setSending(false);
  }

  const people: Record<string, Person> = { [me.id]: me, [other.id]: other };

  return (
    <section aria-label={`Chat with ${other.display_name}`} className="flex h-[32rem] flex-col rounded-3xl border border-line bg-card">
      <header className="flex items-center gap-2 border-b border-line px-4 py-3">
        <Avatar path={other.avatar_path} name={other.display_name} size={28} />
        <h2 className="font-extrabold">Chat with {other.display_name}</h2>
      </header>

      <ol ref={listRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
        {messages.map((message) => {
          if (message.kind === "system") {
            return (
              <li key={message.id} className="text-center">
                <span className="inline-block rounded-full bg-cream px-3 py-1 text-xs font-bold text-muted">
                  {message.body}
                </span>
              </li>
            );
          }
          const mine = message.sender_id === me.id;
          const author = message.sender_id ? people[message.sender_id] : undefined;
          return (
            <li key={message.id} className={`flex items-end gap-2 ${mine ? "flex-row-reverse" : ""}`}>
              {!mine && author && <Avatar path={author.avatar_path} name={author.display_name} size={24} />}
              <div
                className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm ${
                  message.kind === "proposal"
                    ? "border-2 border-accent bg-accent-soft text-navy"
                    : mine
                      ? "bg-accent text-white"
                      : "bg-cream text-navy"
                }`}
              >
                {message.kind === "proposal" && (
                  <p className="text-[11px] font-extrabold uppercase tracking-wide text-accent">
                    {mine ? "You sent a proposal" : `${author?.display_name ?? "They"} sent a proposal`}
                  </p>
                )}
                <p className="whitespace-pre-line break-words">{message.body}</p>
                <p className={`mt-0.5 text-[10px] ${mine && message.kind === "text" ? "text-white/80" : "text-muted"}`}>
                  <time dateTime={message.created_at}>
                    {new Date(message.created_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                  </time>
                </p>
              </div>
            </li>
          );
        })}
        {otherTyping && (
          <li className="text-xs italic text-muted" aria-live="off">
            {other.display_name} is typing…
          </li>
        )}
      </ol>

      {canSend ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
          <label htmlFor="chat-input" className="sr-only">
            Message {other.display_name}
          </label>
          <textarea
            id="chat-input"
            value={text}
            onChange={(e) => handleTyping(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends, Shift+Enter makes a new line.
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
      ) : (
        <p className="border-t border-line p-3 text-center text-sm text-muted">This chat is closed.</p>
      )}
      {error && (
        <p role="alert" className="px-3 pb-3 text-xs font-semibold text-danger">
          {error}
        </p>
      )}
    </section>
  );
}
