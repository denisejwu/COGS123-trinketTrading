"use client";

import { useState } from "react";
import Image from "next/image";
import { publicImageUrl } from "@/lib/storage";

/** Big photo plus clickable thumbnails underneath. */
export function ListingGallery({ paths, title }: { paths: string[]; title: string }) {
  const [active, setActive] = useState(0);
  const current = paths[active] ?? paths[0];

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl border border-line bg-accent-soft">
        {current && (
          <Image
            src={publicImageUrl("listing-images", current)}
            alt={`${title}, photo ${active + 1} of ${paths.length}`}
            fill
            priority
            sizes="(min-width: 768px) 480px, 100vw"
            className="object-cover"
          />
        )}
      </div>

      {paths.length > 1 && (
        <ul className="flex gap-2" aria-label="Choose a photo">
          {paths.map((path, index) => (
            <li key={path}>
              <button
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show photo ${index + 1}`}
                aria-pressed={index === active}
                className={`relative h-16 w-16 overflow-hidden rounded-xl border-2 ${
                  index === active ? "border-accent" : "border-transparent opacity-80 hover:opacity-100"
                }`}
              >
                <Image src={publicImageUrl("listing-images", path)} alt="" fill sizes="64px" className="object-cover" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
