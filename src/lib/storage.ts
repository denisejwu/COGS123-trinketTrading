/**
 * Builds the web address for an image.
 *
 * - Paths starting with "/" are pictures that ship with the app (virtual
 *   trinkets in /public/catalog, default avatars in /public/avatars).
 * - Anything else is a file in a public Supabase Storage bucket; we store
 *   only its path (e.g. "<user id>/123.jpg") and build the full URL here.
 */
export function publicImageUrl(bucket: "avatars" | "listing-images" | "community-covers", path: string) {
  if (path.startsWith("/")) return path;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}

/** True for pictures that ship with the app (nothing to delete from Storage). */
export function isBuiltInImage(path: string | null | undefined) {
  return Boolean(path?.startsWith("/"));
}
