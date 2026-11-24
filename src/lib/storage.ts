/**
 * Builds the public web address for a file in a public Storage bucket.
 * We store only the file's path in the database (e.g. "<user id>/123.jpg")
 * and turn it into a full URL when displaying it.
 */
export function publicImageUrl(bucket: "avatars" | "listing-images" | "community-covers", path: string) {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return `${base}/storage/v1/object/public/${bucket}/${path}`;
}
