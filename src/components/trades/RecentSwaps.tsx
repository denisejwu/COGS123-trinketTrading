import Image from "next/image";
import Link from "next/link";
import { ArrowLeftRight, Star } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { timeAgo } from "@/lib/format";
import { publicImageUrl } from "@/lib/storage";

/** One row from the recent_swaps() database function. */
export type RecentSwap = {
  trade_id: string;
  completed_at: string;
  a_username: string;
  a_name: string;
  a_avatar: string | null;
  a_item_id: string;
  a_item_title: string;
  a_item_image: string | null;
  a_items: number;
  b_username: string;
  b_name: string;
  b_avatar: string | null;
  b_item_id: string;
  b_item_title: string;
  b_item_image: string | null;
  b_items: number;
  stars: number | null;
};

/** One side of a swap: who, and what they gave. */
function Side({
  username,
  name,
  avatar,
  itemId,
  itemTitle,
  itemImage,
  itemCount,
}: {
  username: string;
  name: string;
  avatar: string | null;
  itemId: string;
  itemTitle: string;
  itemImage: string | null;
  itemCount: number;
}) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center gap-1 text-center">
      <Link href={`/u/${username}`} className="flex items-center gap-1 text-xs font-bold hover:underline">
        <Avatar path={avatar} name={name} size={20} />
        <span className="truncate">{name}</span>
      </Link>
      {/* The item's page shows its journey (who owned it before). */}
      <Link href={`/listings/${itemId}`} className="group flex w-full flex-col items-center">
        <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-cream">
          {itemImage && (
            <Image
              src={publicImageUrl("listing-images", itemImage)}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 object-cover"
            />
          )}
        </span>
        <span className="w-full truncate text-xs group-hover:underline">
          {itemTitle}
          {itemCount > 1 && ` +${itemCount - 1}`}
        </span>
      </Link>
    </div>
  );
}

/**
 * "Recent swaps": trades that already happened, so newcomers can see how
 * trading works (who swapped what, and how they rated it).
 */
export function RecentSwaps({ swaps, title = "Recent swaps" }: { swaps: RecentSwap[]; title?: string }) {
  if (swaps.length === 0) return null;
  return (
    <section aria-labelledby="recent-swaps" className="space-y-3">
      <div>
        <h2 id="recent-swaps" className="flex items-center gap-1.5 text-lg font-extrabold">
          <ArrowLeftRight aria-hidden="true" size={20} className="text-accent" />
          {title}
        </h2>
        <p className="text-sm text-muted">Trades that already happened. Tap an item to see its journey.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {swaps.map((swap) => (
          <li key={swap.trade_id} className="space-y-2 rounded-3xl border border-line bg-card p-3">
            <div className="flex items-start gap-1">
              <Side
                username={swap.a_username}
                name={swap.a_name}
                avatar={swap.a_avatar}
                itemId={swap.a_item_id}
                itemTitle={swap.a_item_title}
                itemImage={swap.a_item_image}
                itemCount={swap.a_items}
              />
              <ArrowLeftRight aria-label="swapped with" size={18} className="mt-10 shrink-0 text-accent" />
              <Side
                username={swap.b_username}
                name={swap.b_name}
                avatar={swap.b_avatar}
                itemId={swap.b_item_id}
                itemTitle={swap.b_item_title}
                itemImage={swap.b_item_image}
                itemCount={swap.b_items}
              />
            </div>
            <p className="flex items-center justify-center gap-1 text-xs text-muted">
              {swap.stars !== null && (
                <>
                  <Star aria-hidden="true" size={12} className="fill-current text-accent" />
                  <span>
                    {Number(swap.stars).toFixed(1)}
                    <span className="sr-only"> out of 5 from their reviews</span>
                  </span>
                  <span aria-hidden="true">·</span>
                </>
              )}
              Swapped {timeAgo(swap.completed_at)}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
