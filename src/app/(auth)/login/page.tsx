import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/ui/Notice";
import { safeNextPath } from "@/lib/validation";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Log in" };

// Messages other pages can show here by linking to /login?message=...
const MESSAGES: Record<string, { tone: "info" | "success" | "warning"; text: string }> = {
  "signed-out": { tone: "success", text: "You've been logged out. See you soon!" },
  link: {
    tone: "warning",
    text:
      "That link didn't log you in. This happens if it expired or was opened in a different " +
      "browser. If you were confirming your email, it's confirmed now. Just log in below.",
  },
  "password-updated": { tone: "success", text: "Password updated. Log in with your new password." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const message = typeof params.message === "string" ? MESSAGES[params.message] : undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Welcome back</h1>
        <p className="text-sm text-muted">Log in to see your trades and communities.</p>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      <LoginForm next={next} />

      <div className="space-y-2 text-center text-sm">
        <p>
          <Link href="/reset-password" className="font-bold text-accent hover:underline">
            Forgot your password?
          </Link>
        </p>
        <p className="text-muted">
          New to PopSwap?{" "}
          <Link href="/signup" className="font-bold text-accent hover:underline">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
