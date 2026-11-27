import Link from "next/link";
import { ArrowRight, Check, HelpCircle } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

/** The facts from the my_next_steps() database function. */
export type NextSteps = {
  trader_level: string;
  answer_offer_id: string | null;
  answer_from: string | null;
  confirm_trade_id: string | null;
  review_trade_id: string | null;
  swaps_done: number;
  real_swaps: number;
  reviews_written: number;
  offers_made: number;
  joined_event: boolean;
  live_event_id: string | null;
  live_event_title: string | null;
  room_slug: string | null;
};

type Action = { title: string; body: string; href: string; button: string };

/**
 * Picks the ONE most useful thing to do next. Things other people are
 * waiting on come first (confirming a swap, answering an offer), then the
 * next checklist step.
 */
function nextAction(s: NextSteps): Action {
  const room = s.room_slug ? `/c/${s.room_slug}` : "/communities";
  if (s.confirm_trade_id) {
    return {
      title: "Confirm your swap",
      body: "The other trader is ready. Open the swap room and tap “Confirm swap” to finish.",
      href: `/trades/${s.confirm_trade_id}`,
      button: "Open swap room",
    };
  }
  if (s.answer_offer_id) {
    return {
      title: `Answer ${s.answer_from ?? "your"}'s offer`,
      body: "See what you'd give and get, check the fairness meter, then Accept, Counter or Decline.",
      href: `/offers/${s.answer_offer_id}`,
      button: "See the offer",
    };
  }
  if (s.review_trade_id) {
    return {
      title: "Leave a review",
      body: "Rate how your swap went. Reviews help everyone know who's great to trade with.",
      href: `/trades/${s.review_trade_id}`,
      button: "Write a review",
    };
  }
  if (s.offers_made === 0) {
    return {
      title: "Make your own offer",
      body: "Find an item you like, tap “Make an offer” and pick what you'll give. Practice traders answer instantly.",
      href: room,
      button: "Browse items",
    };
  }
  if (!s.joined_event && s.live_event_id) {
    return {
      title: `Join the ${s.live_event_title ?? "live event"}`,
      body: "It's happening right now in your room. Put an item on the table, vote, or just look around.",
      href: `/events/${s.live_event_id}`,
      button: "Join the event",
    };
  }
  if (s.real_swaps === 0) {
    return {
      title: "Trade with a real person",
      body: "Pick an item without the “Practice trader” badge, or say hi in the room chat to find someone.",
      href: s.room_slug ? `${room}?tab=chat` : room,
      button: "Open room chat",
    };
  }
  return {
    title: "You're a PopSwap pro! 🎉",
    body: "Keep trading: check your Trade matches below, or start an event for your room.",
    href: room,
    button: "Go to your room",
  };
}

export function NextStepCard({ steps }: { steps: NextSteps }) {
  const checklist = [
    { label: "Open your pack", done: true },
    { label: "Finish a swap", done: steps.swaps_done > 0 },
    { label: "Leave a review", done: steps.reviews_written > 0 },
    { label: "Make an offer", done: steps.offers_made > 0 },
    { label: "Join an event", done: steps.joined_event },
    { label: "Swap with a real person", done: steps.real_swaps > 0 },
  ];
  const doneCount = checklist.filter((c) => c.done).length;
  const action = nextAction(steps);

  return (
    <section aria-labelledby="next-step" className="space-y-4 rounded-3xl border-2 border-accent bg-card p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-extrabold uppercase tracking-wide text-accent">
            Your next step · {doneCount} of {checklist.length} done
          </p>
          <h2 id="next-step" className="text-xl font-extrabold">
            {action.title}
          </h2>
          <p className="text-sm text-muted">{action.body}</p>
        </div>
        <Link href={action.href} className={buttonClasses("primary", "shrink-0")}>
          {action.button}
          <ArrowRight aria-hidden="true" size={18} />
        </Link>
      </div>

      <ol aria-label="Checklist" className="flex flex-wrap gap-2">
        {checklist.map((item) => (
          <li
            key={item.label}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
              item.done ? "bg-success-soft text-success" : "bg-cream text-muted"
            }`}
          >
            {item.done ? (
              <Check aria-hidden="true" size={12} />
            ) : (
              <span aria-hidden="true" className="h-3 w-3 rounded-full border-2 border-current" />
            )}
            {item.label}
            <span className="sr-only">{item.done ? " (done)" : " (not yet)"}</span>
          </li>
        ))}
      </ol>

      <details className="rounded-2xl bg-cream p-3 text-sm">
        <summary className="flex cursor-pointer items-center gap-1.5 font-extrabold">
          <HelpCircle aria-hidden="true" size={16} />
          How trading works (1 minute)
        </summary>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>
            Find an item you like and tap <strong>Make an offer</strong>.
          </li>
          <li>
            Pick what you&apos;ll give. The <strong>fairness meter</strong> adds up points (rarity × condition) and tells
            you if it&apos;s Balanced. No money involved.
          </li>
          <li>
            Chat and send <strong>counter-offers</strong> until you agree, then one of you taps <strong>Accept</strong>.
          </li>
          <li>
            In the <strong>swap room</strong>, you both tap <strong>Confirm swap</strong>. The items move into each
            other&apos;s collections.
          </li>
          <li>
            <strong>Leave a review</strong>. It shows up on their profile.
          </li>
        </ol>
        <p className="mt-2 text-muted">
          Traders with the <strong>Practice trader</strong> badge answer instantly, so you can try all of this on your
          own.
        </p>
      </details>
    </section>
  );
}
