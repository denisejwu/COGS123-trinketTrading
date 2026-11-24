import Link from "next/link";
import { Package, SearchX } from "lucide-react";
import { ListingGrid } from "@/components/listings/ListingGrid";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/button";
import {
  CONDITIONS,
  escapeLike,
  isCondition,
  LISTING_CARD_SELECT,
  LISTING_CARD_SELECT_OWNER_FILTER,
  type ListingCardData,
} from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Record<string, string | string[] | undefined>;

/**
 * The Listings tab: filters (search, condition, nearby, showcase) and the
 * grid of matching listings. Filters are a plain GET form, so they live in
 * the URL and survive a refresh.
 */
export async function CommunityListings({
  communityId,
  communitySlug,
  myLocation,
  searchParams,
}: {
  communityId: string;
  communitySlug: string;
  myLocation: string | null;
  searchParams: SearchParams;
}) {
  const text = (key: string) => (typeof searchParams[key] === "string" ? (searchParams[key] as string).trim() : "");
  const search = text("q");
  const condition = isCondition(text("condition")) ? text("condition") : "";
  const nearby = text("nearby") === "1" && Boolean(myLocation);
  const includeShowcase = text("showcase") === "1";
  const filtersActive = Boolean(search || condition || nearby || includeShowcase);

  // Build the query step by step, adding each filter that's switched on.
  const supabase = await createClient();
  let query = supabase
    .from("listings")
    .select(nearby ? LISTING_CARD_SELECT_OWNER_FILTER : LISTING_CARD_SELECT)
    .eq("community_id", communityId)
    .eq("status", "available")
    .order("created_at", { ascending: false })
    .limit(60);
  if (!includeShowcase) query = query.eq("for_trade", true);
  if (condition) query = query.eq("condition", condition as ListingCardData["condition"]);
  if (search) query = query.ilike("title", `%${escapeLike(search)}%`);
  // "Nearby" = the owner's school/city matches yours (ignoring capitals).
  if (nearby && myLocation) query = query.ilike("owner.location", escapeLike(myLocation));

  const { data, error } = await query;
  if (error) throw new Error(`Couldn't load listings: ${error.message}`);
  const listings = (data ?? []) as unknown as ListingCardData[];

  return (
    <div className="space-y-5">
      <form className="grid gap-3 rounded-3xl border border-line bg-card p-4 md:grid-cols-[1fr_auto_auto] md:items-end">
        <input type="hidden" name="tab" value="listings" />
        <div className="space-y-1">
          <label htmlFor="filter-q" className="text-sm font-bold">
            Search titles
          </label>
          <input
            id="filter-q"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="e.g. Smiski"
            className="w-full rounded-full border border-line bg-card px-4 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </div>
        <div className="space-y-1">
          <label htmlFor="filter-condition" className="text-sm font-bold">
            Condition
          </label>
          <select
            id="filter-condition"
            name="condition"
            defaultValue={condition}
            className="w-full rounded-full border border-line bg-card px-4 py-2 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          >
            <option value="">Any condition</option>
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <button type="submit" className={buttonClasses("primary")}>
          Apply filters
        </button>

        <div className="flex flex-wrap gap-x-6 gap-y-2 md:col-span-3">
          <div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                name="nearby"
                value="1"
                defaultChecked={nearby}
                disabled={!myLocation}
                aria-describedby="nearby-hint"
                className="h-4 w-4 accent-accent"
              />
              Nearby only
            </label>
            <p id="nearby-hint" className="ml-6 text-xs text-muted">
              {myLocation ? (
                <>Traders from {myLocation}</>
              ) : (
                <>
                  <Link href="/settings" className="font-bold text-accent hover:underline">
                    Add your school or city
                  </Link>{" "}
                  to use this
                </>
              )}
            </p>
          </div>
          <div>
            <label className="flex items-center gap-2 text-sm font-bold">
              <input
                type="checkbox"
                name="showcase"
                value="1"
                defaultChecked={includeShowcase}
                aria-describedby="showcase-hint"
                className="h-4 w-4 accent-accent"
              />
              Include showcase items
            </label>
            <p id="showcase-hint" className="ml-6 text-xs text-muted">
              Items people are showing off but not trading
            </p>
          </div>
          {filtersActive && (
            <Link
              href={`/c/${communitySlug}?tab=listings`}
              className="self-start text-sm font-bold text-accent hover:underline"
            >
              Clear filters
            </Link>
          )}
        </div>
      </form>

      <ListingGrid
        listings={listings}
        empty={
          filtersActive ? (
            <EmptyState icon={<SearchX size={22} />} title="No listings match these filters">
              Try removing a filter or searching for something else.
            </EmptyState>
          ) : (
            <EmptyState
              icon={<Package size={22} />}
              title="No listings yet"
              action={
                <Link href={`/listings/new?community=${communitySlug}`} className={buttonClasses("primary")}>
                  Post a listing
                </Link>
              }
            >
              Be the first to post one in this community.
            </EmptyState>
          )
        }
      />
    </div>
  );
}
