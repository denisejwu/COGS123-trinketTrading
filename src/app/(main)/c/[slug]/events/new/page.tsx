import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Notice } from "@/components/ui/Notice";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { CreateEventForm } from "./CreateEventForm";

export const metadata: Metadata = { title: "Create an event" };

export default async function NewEventPage({ params }: PageProps<"/c/[slug]/events/new">) {
  const { slug } = await params;
  const myId = await requireUserId();
  const supabase = await createClient();
  const { data: community } = await supabase.from("communities").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!community) notFound();
  const { data: membership } = await supabase
    .from("community_members")
    .select("user_id")
    .eq("community_id", community.id)
    .eq("user_id", myId)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <Link href={`/c/${slug}?tab=events`} className="text-sm font-bold text-accent hover:underline">
          ← {community.name}
        </Link>
        <h1 className="mt-2 text-2xl font-extrabold md:text-3xl">Create an event</h1>
        <p className="text-muted">You&apos;ll be the host: you start it, end it, and (for a mystery swap) reveal it.</p>
      </div>
      {membership ? (
        <div className="rounded-3xl border border-line bg-card p-5 sm:p-6">
          <CreateEventForm communityId={community.id} slug={community.slug} />
        </div>
      ) : (
        <Notice tone="info">Join {community.name} first to create events here.</Notice>
      )}
    </div>
  );
}
