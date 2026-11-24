import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Post a listing" };

// Placeholder until Phase 2.
export default function NewListingPage() {
  return (
    <ComingSoon title="Post a listing">
      Posting trinkets with photos is being built next.
    </ComingSoon>
  );
}
