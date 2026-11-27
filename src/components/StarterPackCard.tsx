"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Award, Gift, Sparkles } from "lucide-react";
import { openStarterPack, type PackResult } from "@/app/(main)/starter-pack/actions";
import { Avatar } from "@/components/Avatar";
import { RarityChip } from "@/components/listings/RarityChip";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { publicImageUrl } from "@/lib/storage";

/**
 * "Open your starter pack": everyone gets 4 random virtual trinkets to
 * trade, revealed one by one like a blind box. It also reveals your trader
 * level and the welcome offer a practice trader just sent you, so your
 * first trade is one tap away.
 */
export function StarterPackCard({ communityId, communityName }: { communityId: string; communityName: string }) {
  const router = useRouter();
  const [result, setResult] = useState<PackResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();

  function open() {
    setError(null);
    startOpening(async () => {
      const result = await openStarterPack(communityId);
      if (result.error) setError(result.error);
      else setResult(result);
    });
  }

  if (result) {
    const items = result.items ?? [];
    const goal = items.find((i) => i.goal)?.goal;
    const experienced = result.level === "experienced";
    return (
      <section aria-labelledby="pack-heading" className="space-y-4 rounded-3xl border-2 border-accent bg-card p-5">
        <div>
          <h2 id="pack-heading" className="text-xl font-extrabold">
            You got {items.length} trinkets!
          </h2>
          <p className="text-sm text-muted">
            They&apos;re up for trade in {communityName}.
            {goal && (
              <>
                {" "}
                Your collecting goal: <strong className="text-navy">{goal}</strong>. Trade for them!
              </>
            )}
          </p>
        </div>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4" aria-live="polite">
          {items.map((item, index) => (
            <li
              key={item.id}
              className="animate-pop-in space-y-1 rounded-2xl bg-cream p-2 text-center"
              style={{ animationDelay: `${index * 350}ms` }}
            >
              {item.image && (
                <Image
                  src={publicImageUrl("listing-images", item.image)}
                  alt={item.title}
                  width={160}
                  height={160}
                  className="mx-auto h-auto w-full max-w-40"
                />
              )}
              <p className="text-sm font-bold">{item.title}</p>
              <RarityChip rarity={item.rarity} />
            </li>
          ))}
        </ul>

        {/* Your trader level */}
        <div
          className="flex animate-pop-in items-start gap-3 rounded-2xl bg-warning-soft p-3 text-sm text-navy"
          style={{ animationDelay: `${items.length * 350}ms` }}
        >
          {experienced ? (
            <Award aria-hidden="true" size={22} className="shrink-0" />
          ) : (
            <Sparkles aria-hidden="true" size={22} className="shrink-0" />
          )}
          <p>
            {experienced ? (
              <>
                <strong>You&apos;re an Experienced trader!</strong> You already have {result.tradesCompleted} trades
                and reviews on your profile, and your 2 latest swaps are in your Showcase. You know the ropes, so show
                the new traders how it&apos;s done!
              </>
            ) : (
              <>
                <strong>You&apos;re a New trader.</strong> Everyone starts somewhere! Do your first swap to earn
                trades and reviews on your profile.
              </>
            )}
          </p>
        </div>

        {/* The welcome offer from a practice trader */}
        {result.welcome ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-accent bg-accent-soft p-3 sm:flex-row sm:items-center">
            <Avatar path={result.welcome.avatar} name={result.welcome.from} size={40} />
            <p className="flex-1 text-sm">
              <strong>{result.welcome.from} already sent you an offer!</strong> They&apos;re a practice trader, so
              they&apos;ll reply instantly. Try your first swap.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link href={`/offers/${result.welcome.offerId}`} className={buttonClasses("primary")}>
                See the offer
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <button type="button" onClick={() => router.refresh()} className={buttonClasses("secondary")}>
                Look around first
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => router.refresh()} className={buttonClasses("primary")}>
            Start trading
          </button>
        )}
      </section>
    );
  }

  return (
    <section
      aria-labelledby="pack-heading"
      className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-accent bg-accent-soft p-6 text-center sm:flex-row sm:text-left"
    >
      <span
        aria-hidden="true"
        className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-accent text-white ${
          opening ? "animate-wiggle" : "animate-bounce-slow"
        }`}
      >
        <Gift size={32} />
      </span>
      <div className="flex-1 space-y-1">
        <h2 id="pack-heading" className="text-lg font-extrabold">
          Your starter pack is here!
        </h2>
        <p className="text-sm text-navy">
          4 random virtual trinkets to trade in {communityName}. Most are Common, some are Rare, and about 1 in 30 is a
          Secret.
        </p>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
      <button type="button" onClick={open} disabled={opening} className={buttonClasses("primary", "shrink-0")}>
        {opening ? "Opening…" : "Open my pack"}
      </button>
    </section>
  );
}
