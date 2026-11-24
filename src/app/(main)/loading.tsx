/** Shown automatically by Next.js while a page in this section loads. */
export default function Loading() {
  return (
    <div role="status" aria-live="polite" className="space-y-4">
      <span className="sr-only">Loading…</span>
      <div className="h-8 w-48 animate-pulse rounded-full bg-line" />
      <div className="h-4 w-72 animate-pulse rounded-full bg-line" />
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="h-32 animate-pulse rounded-3xl bg-line/70" />
        <div className="h-32 animate-pulse rounded-3xl bg-line/70" />
      </div>
    </div>
  );
}
