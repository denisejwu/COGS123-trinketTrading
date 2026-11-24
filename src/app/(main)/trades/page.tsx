import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Trades" };

// Placeholder until Phases 3 and 4.
export default function TradesPage() {
  return (
    <ComingSoon title="Trades">
      Offers and trade rooms with live chat are coming in a later update.
    </ComingSoon>
  );
}
