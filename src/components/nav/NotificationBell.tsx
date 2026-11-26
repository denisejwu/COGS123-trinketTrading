"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

/**
 * The bell in the top bar. Starts with the unread count from the server,
 * then goes up live (Supabase Realtime) whenever a new notification arrives.
 */
export function NotificationBell({ userId, initialUnread }: { userId: string; initialUnread: number }) {
  const pathname = usePathname();
  const [extra, setExtra] = useState(0);
  // A fresh count from the server (after navigating) replaces the live extras.
  const [baseline, setBaseline] = useState(initialUnread);
  if (baseline !== initialUnread) {
    setBaseline(initialUnread);
    setExtra(0);
  }
  const unread = initialUnread + extra;

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;
    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`notifications-${userId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          () => setExtra((n) => n + 1),
        )
        .subscribe();
    })();
    return () => {
      cancelled = true;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [userId]);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
      aria-current={pathname === "/notifications" ? "page" : undefined}
      className="relative rounded-full p-2 text-muted hover:bg-accent-soft hover:text-navy"
    >
      <Bell aria-hidden="true" size={22} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-bold text-white"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
