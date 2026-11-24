"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { resizeImage, uploadFileName } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";
import { removeAvatar, saveAvatar } from "./actions";

/**
 * Upload flow:
 *  1. you pick a photo
 *  2. the browser shrinks it to 512px (fast uploads on phones)
 *  3. the browser uploads it straight to Supabase Storage (avatars/<your id>/...)
 *  4. a server action saves the file path on your profile
 */
export function AvatarUploader({
  userId,
  avatarPath,
  displayName,
}: {
  userId: string;
  avatarPath: string | null;
  displayName: string;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // allow picking the same file again later
    if (!file) return;

    setError(null);
    setUploading(true);
    try {
      const image = await resizeImage(file, 512, 0.9);
      const path = `${userId}/${uploadFileName()}`;

      const supabase = createClient();
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, image, { contentType: "image/jpeg" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

      const result = await saveAvatar(path);
      if (result.status === "error") throw new Error(result.message);

      router.refresh(); // re-render the page with the new photo
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong uploading your photo.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar path={avatarPath} name={displayName} size={88} alt="Your current profile photo" />
        <div className="flex flex-wrap gap-2">
          {/* The real file input is hidden; the styled label opens it. */}
          <label
            className={buttonClasses(
              "secondary",
              "cursor-pointer has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-accent",
            )}
          >
            <Camera aria-hidden="true" size={18} />
            {uploading ? "Uploading…" : avatarPath ? "Change photo" : "Add a photo"}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={handleFile}
              disabled={uploading}
            />
          </label>
          {avatarPath && !uploading && (
            <form action={removeAvatar}>
              <button type="submit" className={buttonClasses("ghost")}>
                Remove
              </button>
            </form>
          )}
        </div>
      </div>
      <p className="text-xs text-muted">A clear photo helps other traders recognize you at meetups.</p>
      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
