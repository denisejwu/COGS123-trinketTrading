"use client";

import { useState, useTransition } from "react";
import { TextField } from "@/components/ui/Field";
import { Notice } from "@/components/ui/Notice";
import { buttonClasses } from "@/components/ui/button";
import { signInWithName } from "@/lib/sign-in";
import { joinRoom } from "../../actions";

/**
 * One field, one button: your name, then you're in the room.
 *  1. sign in with the name (in the browser, so each phone counts on its own)
 *  2. a server action adds you to the room and takes you inside
 */
export function JoinForm({ slug, signedInAs }: { slug: string; signedInAs: string | null }) {
  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      if (!signedInAs) {
        const problem = await signInWithName(name, school);
        if (problem) {
          setError(problem);
          return;
        }
      }
      // On success this redirects into the room, so it only returns on errors.
      const result = await joinRoom(slug);
      if (result?.message) setError(result.message);
    });
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {error && <Notice tone="error">{error}</Notice>}
      {signedInAs ? (
        <p className="text-sm">
          You&apos;re signed in as <strong>{signedInAs}</strong> on this device.
        </p>
      ) : (
        <>
        <TextField
          label="Your name"
          name="display_name"
          autoComplete="nickname"
          required
          maxLength={50}
          placeholder="e.g. Denise W."
          hint="This creates your trader profile. No email or password needed."
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
        </>
      )}
      <button type="submit" disabled={pending} className={buttonClasses("primary", "w-full")}>
        {pending ? "Joining…" : "Join the room"}
      </button>
    </form>
  );
}
