import type { Metadata } from "next";
import { ComingSoon } from "@/components/ComingSoon";

export const metadata: Metadata = { title: "Communities" };

// Placeholder until Phase 2.
export default function CommunitiesPage() {
  return (
    <ComingSoon title="Communities">
      Browsing, joining and creating collector communities is being built next.
    </ComingSoon>
  );
}
