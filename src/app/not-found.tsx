import Link from "next/link";
import { Logo } from "@/components/Logo";
import { buttonClasses } from "@/components/ui/button";

/** Shown for unknown URLs and when a page calls notFound(). */
export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-2xl font-extrabold">We couldn&apos;t find that page</h1>
      <p className="max-w-sm text-muted">
        It may have been deleted, or the link might be wrong.
      </p>
      <Link href="/" className={buttonClasses("primary")}>
        Back to home
      </Link>
    </main>
  );
}
