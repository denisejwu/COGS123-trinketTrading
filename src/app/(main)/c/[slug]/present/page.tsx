import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { CopyLinkButton } from "@/components/CopyLinkButton";
import { RoomLive } from "@/components/communities/RoomLive";
import { requireUserId } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Room QR code" };

/**
 * The host screen: put this on a projector. People scan the QR code,
 * type their name and they're in. The counter and names update live.
 */
export default async function PresentRoomPage({ params }: PageProps<"/c/[slug]/present">) {
  const { slug } = await params;
  await requireUserId();
  const supabase = await createClient();

  const { data: community } = await supabase.from("communities").select("id, slug, name").eq("slug", slug).maybeSingle();
  if (!community) notFound();

  const [{ count }, { data: recent }] = await Promise.all([
    supabase.from("community_members").select("user_id", { count: "exact", head: true }).eq("community_id", community.id),
    supabase
      .from("community_members")
      .select("joined_at, profile:profiles!community_members_user_id_fkey ( display_name, avatar_path )")
      .eq("community_id", community.id)
      .order("joined_at", { ascending: false })
      .limit(24),
  ]);

  // Build the join link from the address this page was opened on, so it
  // works the same on localhost and on Vercel.
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const joinUrl = `${proto}://${host}/join/${community.slug}`;
  // The QR code is drawn as an SVG on the server (a trusted library, not user input).
  const qrSvg = await QRCode.toString(joinUrl, { type: "svg", margin: 1, errorCorrectionLevel: "M" });

  const people = (recent ?? []).map(
    (r) => r.profile as unknown as { display_name: string; avatar_path: string | null },
  );

  return (
    <div className="space-y-6">
      <RoomLive communityId={community.id} />
      <Link href={`/c/${community.slug}`} className="text-sm font-bold text-accent hover:underline">
        ← Back to {community.name}
      </Link>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,28rem)_1fr]">
        <section className="space-y-4 rounded-3xl border border-line bg-card p-6 text-center">
          <p className="text-sm font-bold uppercase tracking-wide text-muted">Scan to join</p>
          <h1 className="text-3xl font-extrabold">{community.name}</h1>
          <div
            role="img"
            aria-label={`QR code that opens ${joinUrl}`}
            className="mx-auto w-full max-w-sm rounded-2xl bg-white p-3 [&_svg]:h-auto [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qrSvg }}
          />
          <div className="space-y-2 rounded-2xl bg-cream p-3">
            <p className="text-xs font-bold uppercase tracking-wide text-muted">On a laptop? Go to</p>
            <p className="break-all text-lg font-extrabold text-accent">{joinUrl}</p>
            <CopyLinkButton url={joinUrl} />
          </div>
          <p className="text-xs text-muted">
            Phones: scan the code. Laptops: type or paste the link. Then type a name, and you&apos;re in. No email or
            password. Each browser is one person.
          </p>
        </section>

        <section aria-labelledby="people-heading" className="space-y-4 rounded-3xl border border-line bg-card p-6">
          <h2 id="people-heading" className="flex items-center gap-2 text-2xl font-extrabold" aria-live="polite">
            <Users aria-hidden="true" size={28} className="text-accent" />
            {count ?? 0} {count === 1 ? "person" : "people"} in the room
          </h2>
          <p className="text-sm text-muted">Newest first. This updates by itself as people join.</p>
          <ul className="flex flex-wrap gap-2">
            {people.map((person, index) => (
              <li
                key={`${person.display_name}-${index}`}
                className="inline-flex items-center gap-2 rounded-full bg-cream px-3 py-1.5 text-sm font-bold"
              >
                <Avatar path={person.avatar_path} name={person.display_name} size={24} />
                {person.display_name}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
