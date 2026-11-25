"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/** Reloads the host screen when someone joins the room (at most every 1.5s). */
export function RoomLive({ communityId }: { communityId: string }) {
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    let cancelled = false;

    (async () => {
      await supabase.realtime.setAuth();
      if (cancelled) return;
      channel = supabase
        .channel(`room-${communityId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "community_members", filter: `community_id=eq.${communityId}` },
          () => {
            if (timer) return;
            timer = setTimeout(() => {
              timer = undefined;
              router.refresh();
            }, 1500);
          },
        )
        .subscribe();
    })();

    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (channel) void supabase.removeChannel(channel);
    };
  }, [communityId, router]);

  return null;
}
