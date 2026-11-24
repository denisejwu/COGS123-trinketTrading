"use client";

import { useEffect } from "react";
import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

/**
 * Shown when something on a page throws an error (for example Supabase is
 * unreachable). Next.js requires error pages to be client components.
 */
export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div role="alert" className="mx-auto max-w-lg space-y-4 rounded-3xl border border-line bg-card p-8 text-center">
      <h1 className="text-xl font-extrabold">Something went wrong</h1>
      <p className="text-sm text-muted">
        {process.env.NODE_ENV === "development"
          ? error.message
          : "We couldn't load this page. Please try again."}
      </p>
      <div className="flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className={buttonClasses("primary")}>
          Try again
        </button>
        <Link href="/" className={buttonClasses("secondary")}>
          Go home
        </Link>
      </div>
    </div>
  );
}
