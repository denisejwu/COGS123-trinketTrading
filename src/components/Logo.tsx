import { ArrowLeftRight } from "lucide-react";

/** The PopSwap wordmark. */
export function Logo({ size = "md" }: { size?: "md" | "lg" }) {
  const big = size === "lg";
  return (
    <span className="inline-flex items-center gap-2 font-extrabold tracking-tight text-navy">
      <span
        aria-hidden="true"
        className={`inline-flex items-center justify-center rounded-xl bg-accent text-white ${
          big ? "h-10 w-10" : "h-8 w-8"
        }`}
      >
        <ArrowLeftRight size={big ? 22 : 18} strokeWidth={2.5} />
      </span>
      <span className={big ? "text-2xl" : "text-lg"}>PopSwap</span>
    </span>
  );
}
