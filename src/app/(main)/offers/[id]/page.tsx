import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftRight, History } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { TraderBadge } from "@/components/TraderBadge";
import { FairnessMeter } from "@/components/trades/FairnessMeter";
import { OfferStatusChip } from "@/components/trades/OfferStatusChip";
import { ProposalItemCard } from "@/components/trades/ProposalItemCard";
import { TradeChat } from "@/components/trades/TradeChat";
import { ActionButton } from "@/components/ui/ActionButton";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth";
import { timeAgo } from "@/lib/format";
import { UUID_PATTERN } from "@/lib/listings";
import { getNegotiation, type Negotiation } from "@/lib/negotiations";
import { acceptOffer, cancelOffer, declineOffer } from "../actions";

export const metadata: Metadata = { title: "Negotiation" };

/** The negotiation room: current proposal, fairness meter, actions and live chat. */
export default async function NegotiationPage({ params }: PageProps<"/offers/[id]">) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();

  const myId = await requireUserId();
  const negotiation = await getNegotiation(id, myId);
  if (!negotiation) notFound();

  const { me, other, currentRound, status } = negotiation;
  const giving = currentRound?.items.filter((i) => i.giverId === me.id) ?? [];
  const getting = currentRound?.items.filter((i) => i.giverId === other.id) ?? [];
  const sentLatest = currentRound?.proposedBy === me.id;
  const earlier = negotiation.rounds.filter((r) => r.id !== currentRound?.id).reverse();

  return (
    <div className="space-y-6">
      <Link href="/offers" className="text-sm font-bold text-accent hover:underline">
        ← All offers
      </Link>

      {/* ---------- Header ---------- */}
      <header className="flex flex-wrap items-center gap-4 rounded-3xl border border-line bg-card p-5">
        <Avatar path={other.avatar_path} name={other.display_name} size={56} />
        <div className="min-w-0 flex-1 space-y-1">
          <h1 className="text-xl font-extrabold md:text-2xl">
            Trading with{" "}
            <Link href={`/u/${other.username}`} className="hover:underline">
              {other.display_name}
            </Link>
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatusChip status={status} yourMove={status === "pending" && !sentLatest} />
            <TraderBadge
              tradesCompleted={other.trades_completed}
              ratingAvg={other.rating_avg}
              ratingCount={other.rating_count}
              isDemo={other.is_demo}
              level={other.trader_level}
            />
          </div>
        </div>
      </header>

      {other.is_demo && status === "pending" && (
        <Notice tone="info">
          <strong>{other.display_name} is a practice trader</strong>, here so you can try trading on your own. They
          answer instantly: if the fairness meter says <strong>Balanced</strong> (or better for them), they accept.
          If not, they&apos;ll ask for a little more.
        </Notice>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_24rem]">
        <div className="space-y-5">
          {/* ---------- Where things stand ---------- */}
          <StatusPanel negotiation={negotiation} sentLatest={sentLatest} />

          {/* ---------- Current proposal ---------- */}
          {currentRound && (
            <section aria-labelledby="proposal-heading" className="space-y-4 rounded-3xl border border-line bg-card p-5">
              <div>
                <h2 id="proposal-heading" className="text-lg font-extrabold">
                  {status === "accepted" ? "The agreed deal" : "Latest proposal"}
                </h2>
                <p className="text-sm text-muted">
                  Proposal {currentRound.roundNo} · sent by {sentLatest ? "you" : other.display_name}{" "}
                  {timeAgo(currentRound.createdAt)}
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <ItemColumn title="You give" items={giving} />
                <ItemColumn title="You get" items={getting} />
              </div>
              <FairnessMeter
                givePoints={giving.map((i) => i.points)}
                getPoints={getting.map((i) => i.points)}
                otherName={other.display_name}
              />
            </section>
          )}

          {/* ---------- Earlier proposals ---------- */}
          {earlier.length > 0 && (
            <details className="rounded-3xl border border-line bg-card p-5">
              <summary className="flex cursor-pointer items-center gap-2 font-extrabold">
                <History aria-hidden="true" size={18} />
                Earlier proposals ({earlier.length})
              </summary>
              <ol className="mt-3 space-y-3">
                {earlier.map((round) => {
                  const by = round.proposedBy === me.id ? "You" : other.display_name;
                  const gives = round.items.filter((i) => i.giverId === me.id).map((i) => i.title);
                  const gets = round.items.filter((i) => i.giverId === other.id).map((i) => i.title);
                  return (
                    <li key={round.id} className="rounded-2xl bg-cream p-3 text-sm">
                      <p className="font-bold">
                        Proposal {round.roundNo} · {by} · {timeAgo(round.createdAt)}
                      </p>
                      <p className="text-muted">
                        You give: {gives.join(", ") || "nothing"} · You get: {gets.join(", ") || "nothing"}
                      </p>
                    </li>
                  );
                })}
              </ol>
            </details>
          )}
        </div>

        {/* ---------- Live chat ---------- */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <TradeChat
            offerId={negotiation.id}
            me={me}
            other={other}
            initialMessages={negotiation.messages}
            canSend={status === "pending" || status === "accepted"}
          />
        </div>
      </div>
    </div>
  );
}

function ItemColumn({ title, items }: { title: string; items: Negotiation["rounds"][number]["items"] }) {
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

/** What you can do right now, depending on the negotiation's state. */
function StatusPanel({ negotiation, sentLatest }: { negotiation: Negotiation; sentLatest: boolean }) {
  const { status, other, id, iAmSender } = negotiation;

  if (status === "accepted") {
    return (
      <div className="space-y-3 rounded-3xl bg-success-soft p-5">
        <p className="font-extrabold text-success">Deal! You both agreed on this trade.</p>
        <p className="text-sm text-navy">
          The items are locked. Head to the swap room to confirm the swap.
        </p>
        {negotiation.trade && (
          <Link href={`/trades/${negotiation.trade.id}`} className={buttonClasses("primary")}>
            <ArrowLeftRight aria-hidden="true" size={18} />
            Go to the swap room
          </Link>
        )}
      </div>
    );
  }

  if (status === "declined" || status === "cancelled") {
    return (
      <Notice tone="info">
        This negotiation is closed{negotiation.closedReason ? `: ${negotiation.closedReason}` : "."}
      </Notice>
    );
  }

  // Still open.
  const walkAway = iAmSender ? (
    <ActionButton
      action={cancelOffer}
      fields={{ offer_id: id }}
      variant="ghost"
      pendingText="Cancelling…"
      confirmText="Cancel this offer? The chat will close."
    >
      Cancel offer
    </ActionButton>
  ) : (
    <ActionButton
      action={declineOffer}
      fields={{ offer_id: id }}
      variant="ghost"
      pendingText="Declining…"
      confirmText="Decline this offer? The chat will close."
    >
      Decline
    </ActionButton>
  );

  return (
    <div className="space-y-3 rounded-3xl border border-line bg-card p-5">
      {sentLatest ? (
        <p className="text-sm">
          <strong>Waiting for {other.display_name}</strong> to accept or send a counter-offer. You can keep chatting
          meanwhile.
        </p>
      ) : (
        <p className="text-sm">
          <strong>Your move.</strong> Accept this proposal, or send a counter-offer if you&apos;d like a different
          mix of items.
        </p>
      )}
      <div className="flex flex-wrap items-start gap-2">
        {!sentLatest && (
          <ActionButton
            action={acceptOffer}
            fields={{ offer_id: id }}
            pendingText="Accepting…"
            confirmText="Accept this proposal? The items will be locked for your swap."
          >
            Accept
          </ActionButton>
        )}
        <Link href={`/offers/${id}/counter`} className={buttonClasses("secondary")}>
          {sentLatest ? "Change my proposal" : "Counter-offer"}
        </Link>
        {walkAway}
      </div>
    </div>
  );
}
