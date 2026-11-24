import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClasses } from "@/components/ui/button";
import { requireUserId } from "@/lib/auth";
import { UUID_PATTERN } from "@/lib/listings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Swap room" };

// Temporary until Phase 4 adds proof photos and "Confirm swap".
export default async function SwapRoomPage({ params }: PageProps<"/trades/[id]">) {
  const { id } = await params;
  if (!UUID_PATTERN.test(id)) notFound();
  await requireUserId();

  const supabase = await createClient();
  const { data: trade } = await supabase.from("trades").select("id, offer_id").eq("id", id).maybeSingle();
  if (!trade) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-extrabold md:text-3xl">Swap room</h1>
      <EmptyState
        icon={<Hammer size={22} />}
        title="Confirming swaps is coming next"
        action={
          <Link href={`/offers/${trade.offer_id}`} className={buttonClasses("primary")}>
            Back to the deal and chat
          </Link>
        }
      >
        Your deal is locked in. Proof photos and the &ldquo;Confirm swap&rdquo; step arrive in the next update.
      </EmptyState>
    </div>
  );
}
