import Link from "next/link";
import { Check } from "lucide-react";
import { plural } from "@/lib/format";
import { CommunityCover } from "./CommunityCover";

export type CommunityCardData = {
  id: string;
  slug: string;
  name: string;
  description: string;
  cover_path: string | null;
  memberCount: number;
  isMember: boolean;
};

/** Card on the "Browse communities" page. The whole card links to the community. */
export function CommunityCard({ community }: { community: CommunityCardData }) {
  return (
    <article className="relative flex h-full flex-col overflow-hidden rounded-3xl border border-line bg-card transition-shadow hover:shadow-md focus-within:shadow-md">
      <CommunityCover slug={community.slug} coverPath={community.cover_path} className="h-28" />
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="font-extrabold">
          <Link
            href={`/c/${community.slug}`}
            className="after:absolute after:inset-0 after:content-[''] focus:outline-none"
          >
            {community.name}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted">{community.description}</p>
        <div className="mt-auto flex items-center gap-2 pt-2 text-xs font-bold">
          <span className="text-muted">{plural(community.memberCount, "member")}</span>
          {community.isMember && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success">
              <Check aria-hidden="true" size={12} />
              Joined
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
