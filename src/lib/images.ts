/**
 * Shrinks a photo in the browser before uploading it.
 *
 * Phone photos are often 3-8 MB. Resizing to a sensible size first makes
 * uploads fast on mobile data and keeps us well under Supabase's limits.
 * Output is always a JPEG.
 */
export async function resizeImage(file: File, maxSize: number, quality = 0.85): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file isn't an image. Please choose a JPG, PNG or WebP photo.");
  }

  let bitmap: ImageBitmap;
  try {
    // createImageBitmap also applies the photo's rotation info (EXIF).
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("We couldn't read that image. Try a JPG or PNG instead.");
  }

  const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Your browser couldn't process this image.");

  // White background so transparent PNGs don't turn black as JPEGs.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Couldn't process that image."))),
      "image/jpeg",
      quality,
    );
  });
}

/** A unique-enough file name for an upload, e.g. "1700000000000-k3j9.jpg". */
export function uploadFileName() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}.jpg`;
}
