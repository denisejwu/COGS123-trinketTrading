import { Scale } from "lucide-react";
import { commonItemsFor, compareSides } from "@/lib/fairness";

/**
 * Shows how balanced a proposal is, from the viewer's side:
 * "You give 3.6 pts · You get 1.8 pts" plus a bar and a suggestion.
 */
export function FairnessMeter({
  givePoints,
  getPoints,
  otherName,
}: {
  givePoints: number[];
  getPoints: number[];
  otherName: string;
}) {
  const result = compareSides(givePoints, getPoints);
  const total = result.give + result.get;
  // 50% = perfectly even. Below 50 = you give more, above = you get more.
  const position = total === 0 ? 50 : Math.round((result.get / total) * 100);

  const verdict =
    result.verdict === "balanced"
      ? { text: "Balanced trade", tone: "text-success" }
      : result.verdict === "you_get_more"
        ? { text: `Leans toward you (+${result.gap} pts)`, tone: "text-[#8a5a00]" }
        : { text: `Leans toward ${otherName} (+${result.gap} pts)`, tone: "text-[#8a5a00]" };

  const n = commonItemsFor(result.gap);
  const suggestion =
    result.verdict === "you_give_more"
      ? `To even it out, ask ${otherName} to add about ${result.gap} points (for example ${n} common item${n === 1 ? "" : "s"}), or remove something from your side.`
      : result.verdict === "you_get_more"
        ? `To even it out, you could add about ${result.gap} points (for example ${n} common item${n === 1 ? "" : "s"}).`
        : null;

  return (
    <section aria-label="Fairness meter" className="space-y-2 rounded-2xl border border-line bg-card p-4">
      <div className="flex items-center justify-between gap-3">
        <p className={`flex items-center gap-1.5 text-sm font-extrabold ${verdict.tone}`}>
          <Scale aria-hidden="true" size={18} />
          {verdict.text}
        </p>
        <p className="text-xs text-muted">
          You give <strong className="text-navy">{result.give}</strong> · You get{" "}
          <strong className="text-navy">{result.get}</strong> pts
        </p>
      </div>

      {/* The bar is decorative; the text above says the same thing. */}
      <div aria-hidden="true" className="relative h-2.5 rounded-full bg-gradient-to-r from-[#fde7c2] via-success-soft to-[#fde7c2]">
        <div className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-success/40" />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-navy shadow"
          style={{ left: `${Math.min(96, Math.max(4, position))}%` }}
        />
      </div>
      <div aria-hidden="true" className="flex justify-between text-[11px] text-muted">
        <span>{otherName} gets more</span>
        <span>Even</span>
        <span>You get more</span>
      </div>

      {suggestion && <p className="text-xs text-navy">{suggestion}</p>}
      <p className="text-[11px] text-muted">
        Points = rarity × condition. It&apos;s just a guide: you both decide what&apos;s fair.
      </p>
    </section>
  );
}
