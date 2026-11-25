"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { addProofPhoto } from "@/app/(main)/trades/actions";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { resizeImage, uploadFileName } from "@/lib/images";
import { createClient } from "@/lib/supabase/client";

type Photo = { id: string; uploader_id: string; url: string | null; caption: string | null };

/**
 * "Check before you swap": each person can post a fresh photo of the
 * actual item. Photos go to a PRIVATE bucket that only the two traders
 * can see: trade-photos/<trade id>/<your id>/<file>.
 */
export function ProofPhotos({
  tradeId,
  meId,
  otherName,
  photos,
  canUpload,
}: {
  tradeId: string;
  meId: string;
  otherName: string;
  photos: Photo[];
  canUpload: boolean;
}) {
  const router = useRouter();
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const image = await resizeImage(file, 1600);
      const path = `${tradeId}/${meId}/${uploadFileName()}`;
      const { error: uploadError } = await createClient()
        .storage.from("trade-photos")
        .upload(path, image, { contentType: "image/jpeg" });
      if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
      const result = await addProofPhoto(tradeId, path, caption);
      if (result.status === "error") throw new Error(result.message);
      setCaption("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  const mine = photos.filter((p) => p.uploader_id === meId);
  const theirs = photos.filter((p) => p.uploader_id !== meId);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <PhotoColumn title="Your photos" photos={mine} empty="You haven't added a photo yet." />
        <PhotoColumn title={`${otherName}'s photos`} photos={theirs} empty={`${otherName} hasn't added a photo yet.`} />
      </div>

      {canUpload && (
        <div className="space-y-2 rounded-2xl bg-cream p-3">
          <label htmlFor="proof-caption" className="block text-sm font-bold">
            Add a proof photo <span className="font-normal text-muted">(optional)</span>
          </label>
          <input
            id="proof-caption"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={200}
            placeholder="Caption, e.g. “Box still sealed”"
            className="block w-full rounded-2xl border border-line bg-card px-4 py-2 text-sm focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
          <label
            className={buttonClasses(
              "secondary",
              "cursor-pointer has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-accent",
            )}
          >
            <Camera aria-hidden="true" size={18} />
            {busy ? "Uploading…" : "Take or choose a photo"}
            <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={busy} />
          </label>
          <p className="text-xs text-muted">
            Tip: show the real item next to a note with today&apos;s date. Only you two can see these.
          </p>
          {error && <Notice tone="error">{error}</Notice>}
        </div>
      )}
    </div>
  );
}

function PhotoColumn({ title, photos, empty }: { title: string; photos: Photo[]; empty: string }) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-extrabold">{title}</h4>
      {photos.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <ul className="grid grid-cols-2 gap-2">
          {photos.map((photo) => (
            <li key={photo.id} className="space-y-1">
              {photo.url && (
                // Private, short-lived link from Supabase, so a plain <img>.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt={photo.caption ?? "Proof photo"}
                  className="aspect-square w-full rounded-xl object-cover"
                />
              )}
              {photo.caption && <p className="text-xs text-muted">{photo.caption}</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
