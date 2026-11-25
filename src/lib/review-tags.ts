/** Review tags, shared by the review form (browser) and server code. */
export const REVIEW_TAGS = [
  { value: "good_trade", label: "Good trade" },
  { value: "trustworthy", label: "Trustworthy" },
  { value: "flexible", label: "Flexible" },
  { value: "as_described", label: "Item as described" },
] as const;

export function reviewTagLabel(value: string) {
  return REVIEW_TAGS.find((t) => t.value === value)?.label ?? value;
}
