import type { Metadata } from "next";
import { Notice } from "@/components/ui/Notice";
import { hasSupabaseEnv } from "@/lib/supabase/env";
import { safeNextPath } from "@/lib/validation";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = { title: "Welcome" };

// Messages other pages can show here by linking to /login?message=...
const MESSAGES: Record<string, { tone: "info" | "success"; text: string }> = {
  "signed-out": { tone: "success", text: "You've been logged out. Enter a name to start again." },
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = safeNextPath(params.next);
  const message = typeof params.message === "string" ? MESSAGES[params.message] : undefined;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold">Welcome to PopSwap</h1>
        <p className="text-sm text-muted">Type your name to create your trader profile.</p>
      </div>

      {message && <Notice tone={message.tone}>{message.text}</Notice>}

      {hasSupabaseEnv() ? (
        <LoginForm next={next} />
      ) : (
        // Shown when the Supabase settings are missing (e.g. not added in Vercel yet).
        <Notice tone="warning">
          PopSwap isn&apos;t connected to Supabase yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> (in <code>.env.local</code> when running locally, or in
          Vercel under Settings → Environment Variables), then restart or redeploy.
        </Notice>
      )}

      <p className="text-center text-xs text-muted">
        Prototype: no email or password needed. Each browser is its own account, so use an Incognito window
        to try trading with a second person.
      </p>
    </div>
  );
}
