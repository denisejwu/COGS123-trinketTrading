"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Star, X } from "lucide-react";
import { resizeImage, uploadFileName } from "@/lib/images";
import { publicImageUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";

const MAX_PHOTOS = 4;

type Photo = {
  key: string;
  /** Storage path once uploaded. */
  path: string | null;
  /** What we show in the thumbnail. */
  previewUrl: string;
  uploading: boolean;
  /** Uploaded during this visit (so we can delete it if removed before saving). */
  isNew: boolean;
};

/**
 * Pick 1-4 photos for a listing. Each photo is shrunk and uploaded to
 * Storage as soon as it's chosen; the form then submits only the paths
 * (as hidden `image_paths` inputs, in order: the first is the cover).
 */
export function PhotoPicker({
  userId,
  initialPaths = [],
  error,
  onBusyChange,
}: {
  userId: string;
  initialPaths?: string[];
  error?: string;
  onBusyChange: (busy: boolean) => void;
}) {
  const [photos, setPhotos] = useState<Photo[]>(() =>
    initialPaths.map((path) => ({
      key: path,
      path,
      previewUrl: publicImageUrl("listing-images", path),
      uploading: false,
      isNew: false,
    })),
  );
  const [uploadError, setUploadError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = photos.some((p) => p.uploading);
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  async function addFiles(files: FileList) {
    setUploadError(null);
    const room = MAX_PHOTOS - photos.length;
    const chosen = Array.from(files).slice(0, room);
    if (files.length > room) setUploadError(`You can add up to ${MAX_PHOTOS} photos.`);

    const supabase = createClient();
    for (const file of chosen) {
      const key = `${Date.now()}-${Math.random()}`;
      try {
        const image = await resizeImage(file, 1600);
        const previewUrl = URL.createObjectURL(image);
        setPhotos((current) => [...current, { key, path: null, previewUrl, uploading: true, isNew: true }]);

        const path = `${userId}/${uploadFileName()}`;
        const { error: err } = await supabase.storage
          .from("listing-images")
          .upload(path, image, { contentType: "image/jpeg" });
        if (err) throw new Error(`Upload failed: ${err.message}`);

        setPhotos((current) => current.map((p) => (p.key === key ? { ...p, path, uploading: false } : p)));
      } catch (err) {
        setPhotos((current) => current.filter((p) => p.key !== key));
        setUploadError(err instanceof Error ? err.message : "Upload failed.");
      }
    }
  }

  function remove(photo: Photo) {
    setPhotos((current) => current.filter((p) => p.key !== photo.key));
    // A photo uploaded during this visit isn't saved anywhere yet, so delete
    // its file right away. Saved photos are cleaned up when the form is saved.
    if (photo.isNew && photo.path) {
      void createClient().storage.from("listing-images").remove([photo.path]);
    }
    if (photo.previewUrl.startsWith("blob:")) URL.revokeObjectURL(photo.previewUrl);
  }

  function makeCover(photo: Photo) {
    setPhotos((current) => [photo, ...current.filter((p) => p.key !== photo.key)]);
  }

  const shownError = uploadError ?? error;

  return (
    <fieldset className="space-y-2" aria-describedby="photos-hint">
      <legend className="text-sm font-bold">Photos</legend>
      <p id="photos-hint" className="text-xs text-muted">
        Add 1 to 4 clear photos of the actual item. The first one is the cover.
      </p>

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {photos.map((photo, index) => (
          <li key={photo.key} className="relative aspect-square overflow-hidden rounded-2xl border border-line bg-accent-soft">
            {/* Previews can be local blob: URLs, which next/image can't load. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.previewUrl}
              alt={`Photo ${index + 1}${index === 0 ? " (cover)" : ""}`}
              className="h-full w-full object-cover"
            />
            {photo.uploading && (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70" role="status">
                <Loader2 aria-hidden="true" className="animate-spin text-accent" />
                <span className="sr-only">Uploading photo…</span>
              </div>
            )}
            {index === 0 && (
              <span className="absolute left-2 top-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-white">
                Cover
              </span>
            )}
            {!photo.uploading && (
              <div className="absolute inset-x-2 bottom-2 flex justify-between gap-1">
                {index !== 0 ? (
                  <button
                    type="button"
                    onClick={() => makeCover(photo)}
                    className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-bold text-navy hover:bg-white"
                  >
                    <Star aria-hidden="true" size={12} />
                    Make cover
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => remove(photo)}
                  aria-label={`Remove photo ${index + 1}`}
                  className="rounded-full bg-white/90 p-1 text-danger hover:bg-white"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </div>
            )}
            {photo.path && <input type="hidden" name="image_paths" value={photo.path} />}
          </li>
        ))}

        {photos.length < MAX_PHOTOS && (
          <li>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed border-line bg-card text-sm font-bold text-accent hover:border-accent hover:bg-accent-soft"
            >
              <ImagePlus aria-hidden="true" size={24} />
              {photos.length === 0 ? "Add photos" : "Add more"}
              <span className="text-xs font-normal text-muted">
                {photos.length} of {MAX_PHOTOS}
              </span>
            </button>
          </li>
        )}
      </ul>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => {
          if (e.target.files?.length) void addFiles(e.target.files);
          e.target.value = "";
        }}
      />
      {shownError && <p className="text-xs font-semibold text-danger">{shownError}</p>}
    </fieldset>
  );
}
