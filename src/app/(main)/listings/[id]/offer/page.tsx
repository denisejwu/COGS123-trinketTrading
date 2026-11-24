import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Make an offer" };

// Placeholder until Phase 3 (offers).
export default function MakeOfferPage() {
  return (
    <ComingSoon title="Make an offer">
      Choosing your own listings to offer in exchange is coming in the next update.
    </ComingSoon>
  );
}
