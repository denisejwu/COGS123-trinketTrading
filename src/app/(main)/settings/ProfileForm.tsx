"use client";

import { useActionState } from "react";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import type { Profile } from "@/lib/database.types";
import { initialFormState, USERNAME_RULES } from "@/lib/validation";
import { updateProfile } from "./actions";

export function ProfileForm({ profile }: { profile: Profile }) {
  const [state, formAction] = useActionState(updateProfile, initialFormState);
  const errors = state.fieldErrors ?? {};
  // After a submit, show what was typed; otherwise show what's saved.
  const value = (name: string, saved: string | null) => state.values?.[name] ?? saved ?? "";

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <FormMessage state={state} />
      <TextField
        label="Display name"
        name="display_name"
        required
        maxLength={50}
        hint="How other traders see you."
        error={errors.display_name}
        defaultValue={value("display_name", profile.display_name)}
      />
      <TextField
        label="Username"
        name="username"
        required
        maxLength={20}
        autoCapitalize="none"
        spellCheck={false}
        hint={`Your profile link is /u/your-username. ${USERNAME_RULES}.`}
        error={errors.username}
        defaultValue={value("username", profile.username)}
      />
      <TextField
        label="School or city"
        name="location"
        optional
        maxLength={80}
        placeholder="e.g. UC San Diego"
        hint="Used for the “Nearby” filter so you can find trades close to you. Shown on your profile."
        error={errors.location}
        defaultValue={value("location", profile.location)}
      />
      <TextAreaField
        label="Bio"
        name="bio"
        optional
        maxLength={280}
        placeholder="What do you collect? What are you hunting for?"
        hint="Up to 280 characters."
        error={errors.bio}
        defaultValue={value("bio", profile.bio)}
      />
      <SubmitButton>Save profile</SubmitButton>
    </form>
  );
}
