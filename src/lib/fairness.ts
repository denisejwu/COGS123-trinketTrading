import type { ListingCondition, ListingRarity } from "@/lib/types";

/**
 * The fairness meter. Without money, we give every item "points":
 *
 *   points = rarity points × condition factor
 *
 * and compare what each person gives. It's a guide, not a rule: both
 * people still decide what's fair for them.
 */

export const RARITIES: { value: ListingRarity; label: string; hint: string; points: number }[] = [
  { value: "common", label: "Common", hint: "Easy to find, lots of collectors have it", points: 1 },
  { value: "uncommon", label: "Uncommon", hint: "Shows up less often in a series", points: 2 },
  { value: "rare", label: "Rare", hint: "Hard to find or a low pull rate", points: 4 },
  { value: "secret", label: "Secret / chase", hint: "The hidden, chase or limited one", points: 8 },
  { value: "unsure", label: "Not sure", hint: "Counts as Common until the community votes", points: 1 },
];

export const CONDITION_FACTOR: Record<ListingCondition, number> = {
  sealed: 1,
  like_new: 0.9,
  gently_used: 0.7,
  well_loved: 0.5,
};

/** After this many votes, the community's pick replaces the owner's guess. */
export const VOTES_NEEDED = 3;

export function rarityLabel(value: ListingRarity) {
  return RARITIES.find((r) => r.value === value)?.label ?? value;
}

export function isRarity(value: unknown): value is ListingRarity {
  return RARITIES.some((r) => r.value === value);
}

/** Counts rarity votes and finds the most popular one. */
export function summarizeVotes(votes: { rarity: ListingRarity }[]) {
  const counts: Partial<Record<ListingRarity, number>> = {};
  for (const v of votes) counts[v.rarity] = (counts[v.rarity] ?? 0) + 1;

  let top: ListingRarity | null = null;
  for (const r of RARITIES) {
    const n = counts[r.value] ?? 0;
    // On a tie, the rarer option wins (later in the list).
    if (n > 0 && (top === null || n >= (counts[top] ?? 0))) top = r.value;
  }
  return { counts, total: votes.length, top };
}

/** The rarity the meter uses: the community's pick once enough people voted. */
export function effectiveRarity(ownerRarity: ListingRarity, votes: { rarity: ListingRarity }[]) {
  const summary = summarizeVotes(votes);
  if (summary.total >= VOTES_NEEDED && summary.top) {
    return { rarity: summary.top, source: "community" as const, votes: summary.total };
  }
  return { rarity: ownerRarity, source: "owner" as const, votes: summary.total };
}

/** Points for one item, rounded to 1 decimal place. */
export function itemPoints(rarity: ListingRarity, condition: ListingCondition) {
  const base = RARITIES.find((r) => r.value === rarity)?.points ?? 1;
  return Math.round(base * CONDITION_FACTOR[condition] * 10) / 10;
}

export type FairnessResult = {
  give: number;
  get: number;
  /** How far apart the two sides are, in points. */
  gap: number;
  verdict: "balanced" | "you_get_more" | "you_give_more";
};

/**
 * Compares the two sides of a trade from YOUR point of view.
 * "Balanced" means within 20% of each other (or half a point).
 */
export function compareSides(givePoints: number[], getPoints: number[]): FairnessResult {
  const give = Math.round(givePoints.reduce((a, b) => a + b, 0) * 10) / 10;
  const get = Math.round(getPoints.reduce((a, b) => a + b, 0) * 10) / 10;
  const gap = Math.round(Math.abs(give - get) * 10) / 10;
  const allowance = Math.max(0.5, 0.2 * Math.max(give, get));

  if (gap <= allowance) return { give, get, gap, verdict: "balanced" };
  return { give, get, gap, verdict: get > give ? "you_get_more" : "you_give_more" };
}

/** Roughly how many common, like-new items would close a gap. */
export function commonItemsFor(gap: number) {
  return Math.max(1, Math.ceil(gap / itemPoints("common", "like_new")));
}
