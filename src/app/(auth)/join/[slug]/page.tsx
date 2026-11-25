import type { Metadata } from "next";
import { CommunityCover } from "@/components/communities/CommunityCover";
import { Notice } from "@/components/ui/Notice";
import { getMyProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { JoinForm } from "./JoinForm";

export const metadata: Metadata = { title: "Join the room" };

/**
 * Where the QR code points: /join/<community slug>.
 * Works before you have an account: type a name and you're in.
 */
export default async function JoinPage({ params }: PageProps<"/join/[slug]">) {
  const { slug } = await params;
  const supabase = await createClient();
  const { data: community } = await supabase
    .from("communities")
    .select("slug, name, description, cover_path")
    .eq("slug", slug)
    .maybeSingle();

  if (!community) {
    return <Notice tone="warning">This room link doesn&apos;t work any more. Ask the host for a new QR code.</Notice>;
  }

  const me = await getMyProfile().catch(() => null);

  return (
    <div className="space-y-5">
      <div className="overflow-hidden rounded-2xl border border-line">
        <CommunityCover slug={community.slug} coverPath={community.cover_path} className="h-24" iconSize={40} />
        <div className="p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-muted">You&apos;re invited to</p>
          <h1 className="text-2xl font-extrabold">{community.name}</h1>
          {community.description && <p className="mt-1 text-sm text-muted">{community.description}</p>}
        </div>
      </div>
      <JoinForm slug={community.slug} signedInAs={me?.display_name ?? null} />
    </div>
  );
}
