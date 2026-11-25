"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Gift } from "lucide-react";
import { openStarterPack, type PackItem } from "@/app/(main)/starter-pack/actions";
import { RarityChip } from "@/components/listings/RarityChip";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { publicImageUrl } from "@/lib/storage";

/**
 * "Open your starter pack": everyone gets 4 random virtual trinkets to
 * trade, revealed one by one like a blind box.
 */
export function StarterPackCard({ communityId, communityName }: { communityId: string; communityName: string }) {
  const router = useRouter();
  const [items, setItems] = useState<PackItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opening, startOpening] = useTransition();

  function open() {
    setError(null);
    startOpening(async () => {
      const result = await openStarterPack(communityId);
      if (result.error) setError(result.error);
      else setItems(result.items ?? []);
    });
  }

  if (items) {
    const goal = items.find((i) => i.goal)?.goal;
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
        <button
          type="button"
          onClick={() => router.refresh()}
          className={buttonClasses("primary")}
        >
          Start trading
        </button>
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
