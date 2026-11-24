import Image from "next/image";
import { communityLook } from "@/lib/communities";
import { publicImageUrl } from "@/lib/storage";

/** A community's cover photo, or a coloured block with its icon. */
export function CommunityCover({
  slug,
  coverPath,
  className = "",
  iconSize = 40,
}: {
  slug: string;
  coverPath: string | null;
  className?: string;
  iconSize?: number;
}) {
  const { Icon, colors } = communityLook(slug);

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={coverPath ? undefined : { background: colors.bg, color: colors.fg }}
    >
      {coverPath ? (
        <Image
          src={publicImageUrl("community-covers", coverPath)}
          alt=""
          fill
          sizes="(min-width: 768px) 960px, 100vw"
          className="object-cover"
        />
      ) : (
        <Icon aria-hidden="true" size={iconSize} className="absolute inset-0 m-auto opacity-80" />
      )}
    </div>
  );
}
