import type { Metadata } from "next";
import { Notice } from "@/components/ui/Notice";
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

      <LoginForm next={next} />

      <p className="text-center text-xs text-muted">
        Prototype: no email or password needed. Each browser is its own account, so use an Incognito window
        to try trading with a second person.
      </p>
    </div>
  );
}
