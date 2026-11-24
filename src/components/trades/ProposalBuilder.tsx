"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { Lock } from "lucide-react";
import { counterOffer, startOffer } from "@/app/(main)/offers/actions";
import { TextAreaField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { ProposalItem } from "@/lib/negotiations";
import { initialFormState } from "@/lib/validation";
import { FairnessMeter } from "./FairnessMeter";
import { ProposalItemCard } from "./ProposalItemCard";

/**
 * Build a proposal: tick items on both sides, watch the fairness meter
 * update live, add a message, send. Used for the first offer and for
 * counter-offers.
 */
export function ProposalBuilder({
  mode,
  offerId,
  targetListingId,
  otherName,
  myItems,
  theirItems,
  initialSelected,
}: {
  mode: "start" | "counter";
  /** For counter-offers. */
  offerId?: string;
  /** For a first offer: the listing you're offering on (always included). */
  targetListingId?: string;
  otherName: string;
  myItems: ProposalItem[];
  theirItems: ProposalItem[];
  initialSelected: string[];
}) {
  const [state, formAction] = useActionState(mode === "start" ? startOffer : counterOffer, initialFormState);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(initialSelected));

  function toggle(id: string) {
    if (id === targetListingId) return; // the item you're offering on stays in
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const giving = myItems.filter((i) => selected.has(i.id));
  const getting = theirItems.filter((i) => selected.has(i.id));
  const ready = giving.length > 0 && getting.length > 0;

  return (
    <form action={formAction} className="space-y-6">
      {mode === "counter" && offerId && <input type="hidden" name="offer_id" value={offerId} />}
      {mode === "start" && targetListingId && <input type="hidden" name="listing_id" value={targetListingId} />}
      {[...selected].map((id) => (
        <input key={id} type="hidden" name="listing_ids" value={id} />
      ))}

      <FormMessage state={state} />

      <div className="grid gap-6 lg:grid-cols-2">
        <ItemPicker
          title="You give"
          hint="Pick one or more of your items that are up for trade."
          items={myItems}
          selected={selected}
          onToggle={toggle}
          empty={
            <>
              You don&apos;t have anything up for trade yet.{" "}
              <Link href="/listings/new" className="font-bold text-accent hover:underline">
                Post a listing
              </Link>{" "}
              first.
            </>
          }
        />
        <ItemPicker
          title="You get"
          hint={`${otherName}'s items. Add more to balance the trade.`}
          items={theirItems}
          selected={selected}
          onToggle={toggle}
          lockedId={targetListingId}
          empty={<>{otherName} has nothing else up for trade right now.</>}
        />
      </div>

      <div className="sticky bottom-20 z-20 md:bottom-4">
        <FairnessMeter
          givePoints={giving.map((i) => i.points)}
          getPoints={getting.map((i) => i.points)}
          otherName={otherName}
        />
      </div>

      <TextAreaField
        label="Message"
        name="message"
        optional
        maxLength={1000}
        placeholder={mode === "start" ? "Say hi and explain your offer…" : "Explain your counter-offer…"}
        hint="Shows up in your chat with them."
        defaultValue={state.values?.message}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton disabled={!ready} pendingText="Sending…">
          {mode === "start" ? "Send offer" : "Send counter-offer"}
        </SubmitButton>
        {!ready && (
          <span className="text-sm text-muted">Pick at least one item on each side.</span>
        )}
      </div>
    </form>
  );
}

function ItemPicker({
  title,
  hint,
  items,
  selected,
  onToggle,
  lockedId,
  empty,
}: {
  title: string;
  hint: string;
  items: ProposalItem[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  lockedId?: string;
  empty: React.ReactNode;
}) {
  const count = items.filter((i) => selected.has(i.id)).length;
  return (
    <fieldset className="space-y-2">
      <legend className="text-lg font-extrabold">
        {title} <span className="text-sm font-bold text-muted">({count} selected)</span>
      </legend>
      <p className="text-sm text-muted">{hint}</p>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => {
            const locked = item.id === lockedId;
            return (
              <li key={item.id}>
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-2xl border bg-card p-3 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent ${
                    selected.has(item.id) ? "border-accent bg-accent-soft/50" : "border-line"
                  } ${locked ? "cursor-default" : ""}`}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(item.id)}
                    onChange={() => onToggle(item.id)}
                    disabled={locked}
                    className="h-5 w-5 shrink-0 accent-accent"
                  />
                  <div className="min-w-0 flex-1">
                    <ProposalItemCard item={item} note={locked ? "The item you're making an offer on" : undefined} />
                  </div>
                  {locked && <Lock aria-label="Always included" size={16} className="shrink-0 text-muted" />}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </fieldset>
  );
}
