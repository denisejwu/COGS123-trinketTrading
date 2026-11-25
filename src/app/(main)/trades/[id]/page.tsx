import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, PartyPopper } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Stars } from "@/components/Stars";
import { ProofPhotos } from "@/components/trades/ProofPhotos";
import { ProposalItemCard } from "@/components/trades/ProposalItemCard";
import { ReviewForm } from "@/components/trades/ReviewForm";
import { TradeChat } from "@/components/trades/TradeChat";
import { ActionButton } from "@/components/ui/ActionButton";
import { Notice } from "@/components/ui/Notice";
import { requireUserId } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/listings";
import { reviewTagLabel } from "@/lib/review-tags";
import { getSwap, type Swap } from "@/lib/swaps";
import { cancelSwap, confirmSwap } from "../actions";

export const metadata: Metadata = { title: "Swap room" };

/**
 * The swap room: the agreed deal, optional proof photos, both people
 * confirm (then the items change owners), then a review. Chat on the side.
 */
export default async function SwapRoomPage({ params }: PageProps<"/trades/[id]">) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const myId = await requireUserId();
  const swap = await getSwap(id, myId);
  if (!swap) notFound();

  const { other, status } = swap;

  return (
    <div className="space-y-6">
      <Link href="/trades" className="text-sm font-bold text-accent hover:underline">
        ← All swaps
      </Link>

      <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-card p-5">
        <Avatar path={other.avatar_path} name={other.display_name} size={56} />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-extrabold md:text-2xl">
            Swap with{" "}
            <Link href={`/u/${other.username}`} className="hover:underline">
              {other.display_name}
            </Link>
          </h1>
          <p className="text-sm text-muted">
            {status === "planning" && "Getting ready to swap"}
            {status === "completed" && "Swapped"}
            {status === "cancelled" && "Cancelled"}
          </p>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="min-w-0 space-y-5">
          {status === "completed" && <CompletedPanel swap={swap} />}
          {status === "cancelled" && (
            <Notice tone="info">This swap was cancelled. The items went back to being available.</Notice>
          )}

          {/* ---------- The deal ---------- */}
          <section aria-labelledby="deal-heading" className="space-y-4 rounded-3xl border border-line bg-card p-5">
            <h2 id="deal-heading" className="text-lg font-extrabold">
              The deal
            </h2>
            <div className="grid gap-4 md:grid-cols-2">
              <ItemList title={status === "completed" ? "You gave" : "You give"} items={swap.giving} />
              <ItemList title={status === "completed" ? "You got" : "You get"} items={swap.getting} />
            </div>
          </section>

          {status === "planning" && (
            <>
              {/* ---------- Step 1: proof photos ---------- */}
              <section aria-labelledby="proof-heading" className="space-y-3 rounded-3xl border border-line bg-card p-5">
                <div>
                  <h2 id="proof-heading" className="text-lg font-extrabold">
                    Step 1 · Check before you swap
                  </h2>
                  <p className="text-sm text-muted">
                    Optional: post a fresh photo of the real item so the other person knows it matches the listing.
                  </p>
                </div>
                <ProofPhotos
                  tradeId={swap.id}
                  meId={swap.me.id}
                  otherName={other.display_name}
                  photos={swap.photos}
                  canUpload
                />
              </section>

              {/* ---------- Step 2: confirm ---------- */}
              <section aria-labelledby="confirm-heading" className="space-y-3 rounded-3xl border border-line bg-card p-5">
                <div>
                  <h2 id="confirm-heading" className="text-lg font-extrabold">
                    Step 2 · Both confirm the swap
                  </h2>
                  <p className="text-sm text-muted">
                    When you both confirm, the items move into each other&apos;s collections (Showcase). This
                    can&apos;t be undone.
                  </p>
                </div>
                <ul className="space-y-1 text-sm">
                  <ConfirmLine done={swap.iConfirmed} label="You" />
                  <ConfirmLine done={swap.theyConfirmed} label={other.display_name} />
                </ul>
                <div className="flex flex-wrap items-start gap-2">
                  {!swap.iConfirmed && (
                    <ActionButton
                      action={confirmSwap}
                      fields={{ trade_id: swap.id }}
                      pendingText="Confirming…"
                      confirmText="Confirm the swap? Once you both confirm, the items change owners."
                    >
                      Confirm swap
                    </ActionButton>
                  )}
                  <ActionButton
                    action={cancelSwap}
                    fields={{ trade_id: swap.id }}
                    variant="ghost"
                    className="text-danger hover:bg-danger-soft"
                    pendingText="Cancelling…"
                    confirmText="Cancel this swap? The items will be available again."
                  >
                    Cancel swap
                  </ActionButton>
                </div>
              </section>
            </>
          )}
        </div>

        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <TradeChat
            offerId={swap.offerId}
            me={swap.me}
            other={other}
            initialMessages={swap.messages}
            canSend={status !== "cancelled"}
          />
        </div>
      </div>
    </div>
  );
}

function ConfirmLine({ done, label }: { done: boolean; label: string }) {
  return (
    <li className={`flex items-center gap-2 font-bold ${done ? "text-success" : "text-muted"}`}>
      {done ? <CheckCircle2 aria-hidden="true" size={18} /> : <Circle aria-hidden="true" size={18} />}
      {label} {done ? "confirmed" : "hasn't confirmed yet"}
    </li>
  );
}

function ItemList({ title, items }: { title: string; items: Swap["giving"] }) {
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-extrabold uppercase tracking-wide text-muted">{title}</h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <Link href={`/listings/${item.id}`} className="block rounded-2xl border border-line p-2 hover:bg-cream">
              <ProposalItemCard item={item} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** After both confirmed: celebrate, then review each other. */
function CompletedPanel({ swap }: { swap: Swap }) {
  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 rounded-3xl bg-success-soft p-5">
        <PartyPopper aria-hidden="true" className="shrink-0 text-success" size={28} />
        <div>
          <p className="font-extrabold text-success">Swap complete!</p>
          <p className="text-sm text-navy">
            Your new items are in your{" "}
            <Link href={`/u/${swap.me.username}?tab=showcase`} className="font-bold text-accent hover:underline">
              Showcase
            </Link>
            . Edit one and switch it to &ldquo;Up for trade&rdquo; whenever you want to trade it on.
          </p>
        </div>
      </div>

      <section aria-labelledby="review-heading" className="space-y-3 rounded-3xl border border-line bg-card p-5">
        <h2 id="review-heading" className="text-lg font-extrabold">
          Review {swap.other.display_name}
        </h2>
        {swap.myReview ? (
          <ReviewSummary review={swap.myReview} label="Your review" />
        ) : (
          <ReviewForm tradeId={swap.id} otherName={swap.other.display_name} />
        )}
        {swap.theirReview && <ReviewSummary review={swap.theirReview} label={`${swap.other.display_name}'s review of you`} />}
      </section>
    </div>
  );
}

function ReviewSummary({
  review,
  label,
}: {
  review: { rating: number; tags: string[]; comment: string | null };
  label: string;
}) {
  return (
    <div className="space-y-1 rounded-2xl bg-cream p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <Stars rating={review.rating} />
      {review.tags.length > 0 && (
        <p className="text-sm font-bold text-accent">{review.tags.map(reviewTagLabel).join(" · ")}</p>
      )}
      {review.comment && <p className="text-sm">{review.comment}</p>}
    </div>
  );
}
