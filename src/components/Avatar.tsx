import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";

/**
 * Round profile picture. Falls back to the person's initials if they
 * haven't uploaded a photo.
 *
 * The image is decorative by default (alt="") because the person's name is
 * almost always shown right next to it.
 */
export function Avatar({
  path,
  name,
  size = 40,
  alt = "",
}: {
  path: string | null;
  name: string;
  size?: number;
  alt?: string;
}) {
  const style = { width: size, height: size };

  if (path) {
    return (
      <Image
        src={publicImageUrl("avatars", path)}
        alt={alt}
        width={size}
        height={size}
        style={style}
        className="shrink-0 rounded-full bg-accent-soft object-cover"
      />
    );
  }

  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase())
    .join("");

  return (
    <span
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
      role={alt ? "img" : undefined}
      style={{ ...style, fontSize: Math.max(12, size * 0.38) }}
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-extrabold text-accent"
    >
      {initials || "?"}
    </span>
  );
}
