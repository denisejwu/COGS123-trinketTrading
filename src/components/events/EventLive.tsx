"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Keeps an event page live: when anyone adds an entry, votes, or the host
 * starts/ends/reveals, everyone's page reloads its data. Updates are
 * bundled (at most one reload every 1.5 seconds) so 50 people voting at
 * once doesn't overload anything.
 */
export function EventLive({ eventId }: { eventId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refreshSoon = () => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        router.refresh();
      }, 1500);
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`event-${eventId}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "event_entries", filter: `event_id=eq.${eventId}` }, refreshSoon)
        .on("postgres_changes", { event: "*", schema: "public", table: "event_votes", filter: `event_id=eq.${eventId}` }, refreshSoon)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "events", filter: `id=eq.${eventId}` }, refreshSoon)
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [eventId, router]);

  return null;
}
