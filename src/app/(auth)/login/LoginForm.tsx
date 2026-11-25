"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { signInWithName } from "@/lib/sign-in";

/** Type a name, get an account. The sign-in runs in the browser (see lib/sign-in.ts). */
export function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const problem = await signInWithName(name, school);
      if (problem) {
        setError(problem);
        return;
      }
      router.replace(next);
      router.refresh();
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      <TextField
        label="Your name"
        name="display_name"
        autoComplete="nickname"
        required
        maxLength={50}
        placeholder="e.g. Denise W."
        hint="How other traders will see you. You can change it later in Settings."
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <TextField
        label="School or city"
        name="location"
        optional
        maxLength={80}
        placeholder="e.g. UC San Diego"
        hint="Shows “Same school as you” on profiles and powers the Nearby filter."
        value={school}
        onChange={(e) => setSchool(e.target.value)}
      />
      <button type="submit" disabled={pending} className={buttonClasses("primary", "w-full")}>
        {pending ? "Setting things up…" : "Start trading"}
      </button>
    </form>
  );
}
