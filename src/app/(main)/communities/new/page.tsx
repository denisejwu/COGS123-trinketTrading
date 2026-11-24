import type { Metadata } from "next";
import Link from "next/link";
import { requireUserId } from "@/lib/auth";
import { CreateCommunityForm } from "./CreateCommunityForm";

export const metadata: Metadata = { title: "Start a community" };

export default async function NewCommunityPage() {
  const userId = await requireUserId();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href="/communities" className="text-sm font-bold text-accent hover:underline">
          ← All communities
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Start a community</h1>
        <p className="text-muted">
          A home for one kind of collectible. You&apos;ll join it automatically.
        </p>
      </div>
      <div className="rounded-3xl border border-line bg-card p-6">
        <CreateCommunityForm userId={userId} />
      </div>
    </div>
  );
}
