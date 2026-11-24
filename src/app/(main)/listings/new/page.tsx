import type { Metadata } from "next";
import { ListingForm } from "@/components/listings/ListingForm";
import { requireUserId } from "@/lib/auth";
import { getCommunityOptions } from "@/lib/community-options";

export const metadata: Metadata = { title: "Post a listing" };

export default async function NewListingPage({ searchParams }: PageProps<"/listings/new">) {
  const { community } = await searchParams;
  const userId = await requireUserId();
  const communities = await getCommunityOptions(userId);

  // /listings/new?community=blind-boxes preselects that community.
  const preselected = communities.find((c) => c.slug === community)?.id;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold md:text-3xl">Post a listing</h1>
        <p className="text-muted">Share something you&apos;d trade, or something you&apos;re proud of.</p>
      </div>
      <div className="rounded-3xl border border-line bg-card p-5 sm:p-6">
        <ListingForm userId={userId} communities={communities} defaultCommunityId={preselected} />
      </div>
    </div>
  );
}
