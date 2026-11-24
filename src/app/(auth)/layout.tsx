import Link from "next/link";
import { Logo } from "@/components/Logo";

/** Layout for login / sign-up / reset pages: a centered card, no nav bar. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4 py-10">
      <Link href="/login" aria-label="PopSwap home">
        <Logo size="lg" />
      </Link>
      <p className="mt-2 text-center text-sm text-muted">
        Swap trinkets with collectors who get it.
      </p>
      <div className="mt-6 w-full max-w-md rounded-3xl border border-line bg-card p-6 shadow-sm sm:p-8">
        {children}
      </div>
    </main>
  );
}
