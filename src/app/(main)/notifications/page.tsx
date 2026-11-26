import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowLeftRight,
  Bell,
  CheckCircle2,
  MessageCircle,
  PartyPopper,
  Star,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { requireUserId } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";
import { markAllRead } from "./actions";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, LucideIcon> = {
  new_offer: ArrowLeftRight,
  counter_offer: ArrowLeftRight,
  offer_accepted: CheckCircle2,
  offer_declined: XCircle,
  trade_message: MessageCircle,
  direct_message: MessageCircle,
  swap_confirmed: CheckCircle2,
  swap_completed: PartyPopper,
  new_review: Star,
  new_friend: UserPlus,
};

export default async function NotificationsPage() {
  await requireUserId();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, type, body, link, read_at, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  const notifications = data ?? [];
  const unread = notifications.filter((n) => !n.read_at).length;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold md:text-3xl">Notifications</h1>
          <p className="text-sm text-muted">
            {unread > 0 ? `${unread} new` : "You're all caught up."} Offers, messages, swaps, reviews and friends.
          </p>
        </div>
        {unread > 0 && (
          <form action={markAllRead}>
            <SubmitButton variant="secondary" pendingText="…">
              Mark all as read
            </SubmitButton>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={22} />} title="No notifications yet">
          When someone makes you an offer, messages you or reviews you, it shows up here.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {notifications.map((n) => {
            const Icon = ICONS[n.type] ?? Bell;
            return (
              <li key={n.id}>
                {/* Opening it marks it as read, then takes you to the right page. */}
                <Link
                  href={`/notifications/${n.id}`}
                  prefetch={false}
                  className={`flex items-start gap-3 rounded-3xl border bg-card p-4 hover:shadow-md ${
                    n.read_at ? "border-line" : "border-accent bg-accent-soft/40"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent"
                  >
                    <Icon size={18} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block break-words ${n.read_at ? "" : "font-bold"}`}>{n.body}</span>
                    <span className="text-xs text-muted">{timeAgo(n.created_at)}</span>
                  </span>
                  {!n.read_at && <span className="sr-only">(new)</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
