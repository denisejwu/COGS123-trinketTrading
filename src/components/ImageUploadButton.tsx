"use client";

import { useState } from "react";
import { ImagePlus } from "lucide-react";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { resizeImage, uploadFileName } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

/**
 * Uploads ONE image straight from the browser to a Storage bucket
 * (into the user's own folder) and reports the saved path.
 * Used for community covers.
 */
export function ImageUploadButton({
  bucket,
  userId,
  maxSize = 1600,
  label = "Upload image",
  onUploaded,
  onBusyChange,
}: {
  bucket: "community-covers" | "listing-images";
  userId: string;
  maxSize?: number;
  label?: string;
  onUploaded: (path: string, previewUrl: string) => void;
  onBusyChange?: (busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError(null);
    setBusy(true);
    onBusyChange?.(true);
    try {
      const image = await resizeImage(file, maxSize);
      const path = `${userId}/${uploadFileName()}`;
      const { error: uploadError } = await createClient()
        .storage.from(bucket)
        .upload(path, image, { contentType: "image/jpeg" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      onUploaded(path, URL.createObjectURL(image));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      onBusyChange?.(false);
    }
  }

  return (
    <div className="space-y-2">
      <label
        className={buttonClasses(
          "secondary",
          "cursor-pointer has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-accent",
        )}
      >
        <ImagePlus aria-hidden="true" size={18} />
        {busy ? "Uploading…" : label}
        <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={busy} />
      </label>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
