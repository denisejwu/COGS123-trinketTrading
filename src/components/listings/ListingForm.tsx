"use client";

import { useActionState, useState } from "react";
import { createListing, updateListing } from "@/app/(main)/listings/actions";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { RARITIES } from "@/lib/fairness";
import { CONDITIONS } from "@/lib/listings";
import { initialFormState } from "@/lib/validation";
import { PhotoPicker } from "./PhotoPicker";

export type ListingFormInitial = {
  id: string;
  community_id: string;
  title: string;
  description: string;
  condition: string;
  rarity: string;
  size: string | null;
  looking_for: string | null;
  for_trade: boolean;
  image_paths: string[];
};

/** The "Post a listing" form, also used for editing. */
export function ListingForm({
  userId,
  communities,
  defaultCommunityId,
  initial,
}: {
  userId: string;
  communities: { id: string; name: string; joined: boolean }[];
  defaultCommunityId?: string;
  /** Present when editing an existing listing. */
  initial?: ListingFormInitial;
}) {
  const isEdit = Boolean(initial);
  const [state, formAction] = useActionState(isEdit ? updateListing : createListing, initialFormState);
  const [photosBusy, setPhotosBusy] = useState(false);
  const errors = state.fieldErrors ?? {};

  // After a failed submit, show what was typed; otherwise the saved values.
  const v = (name: keyof Omit<ListingFormInitial, "id" | "image_paths" | "for_trade">) =>
    state.values?.[name] ?? initial?.[name] ?? "";
  const [forTrade, setForTrade] = useState(initial?.for_trade ?? true);

  const joined = communities.filter((c) => c.joined);
  const others = communities.filter((c) => !c.joined);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {initial && <input type="hidden" name="listing_id" value={initial.id} />}
      <FormMessage state={state} />

      <PhotoPicker
        userId={userId}
        initialPaths={initial?.image_paths}
        error={errors.photos}
        onBusyChange={setPhotosBusy}
      />

      <TextField
        label="Title"
        name="title"
        required
        maxLength={80}
        placeholder="e.g. Smiski Bed Series – Sleeping"
        hint="Name the series and the exact figure or design."
        error={errors.title}
        defaultValue={v("title")}
      />

      <div className="space-y-1.5">
        <label htmlFor="field-community_id" className="block text-sm font-bold">
          Community
        </label>
        <select
          id="field-community_id"
          name="community_id"
          required
          defaultValue={v("community_id") || defaultCommunityId || ""}
          aria-describedby="community-hint"
          aria-invalid={errors.community_id ? true : undefined}
          className={`block w-full rounded-2xl border bg-card px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30 ${
            errors.community_id ? "border-danger" : "border-line"
          }`}
        >
          <option value="" disabled>
            Choose a community…
          </option>
          {joined.length > 0 && (
            <optgroup label="Your communities">
              {joined.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </optgroup>
          )}
          <optgroup label={joined.length > 0 ? "Other communities" : "All communities"}>
            {others.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </optgroup>
        </select>
        <p id="community-hint" className="text-xs text-muted">
          Where this listing shows up. Posting in a community also joins you to it.
        </p>
        {errors.community_id && <p className="text-xs font-semibold text-danger">{errors.community_id}</p>}
      </div>

      {/* Condition: radio "cards" with a hint each, so everyone means the same thing. */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Condition</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {CONDITIONS.map((c) => (
            <label
              key={c.value}
              className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-card p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="condition"
                value={c.value}
                defaultChecked={v("condition") === c.value}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <span>
                <span className="block text-sm font-bold">{c.label}</span>
                <span className="block text-xs text-muted">{c.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.condition && <p className="text-xs font-semibold text-danger">{errors.condition}</p>}
      </fieldset>

      {/* Rarity: feeds the fairness meter. Other collectors can vote on it later. */}
      <fieldset className="space-y-2" aria-describedby="rarity-hint">
        <legend className="text-sm font-bold">Rarity</legend>
        <p id="rarity-hint" className="text-xs text-muted">
          Used by the fairness meter when people make offers. Other collectors can vote if they disagree.
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
          {RARITIES.map((r) => (
            <label
              key={r.value}
              className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-card p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="rarity"
                value={r.value}
                defaultChecked={(v("rarity") || "unsure") === r.value}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <span>
                <span className="block text-sm font-bold">{r.label}</span>
                <span className="block text-xs text-muted">{r.hint}</span>
              </span>
            </label>
          ))}
        </div>
        {errors.rarity && <p className="text-xs font-semibold text-danger">{errors.rarity}</p>}
      </fieldset>

      {/* For trade or showcase only */}
      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">Is this up for trade?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            { value: true, label: "Up for trade", hint: "Other collectors can send you offers." },
            { value: false, label: "Showcase only", hint: "Just showing it off. Nobody can make offers." },
          ].map((option) => (
            <label
              key={String(option.value)}
              className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-card p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
            >
              <input
                type="radio"
                name="for_trade"
                value={String(option.value)}
                checked={forTrade === option.value}
                onChange={() => setForTrade(option.value)}
                className="mt-1 h-4 w-4 accent-accent"
              />
              <span>
                <span className="block text-sm font-bold">{option.label}</span>
                <span className="block text-xs text-muted">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {forTrade && (
        <TextField
          label="Looking for"
          name="looking_for"
          optional
          maxLength={200}
          placeholder="e.g. Sprinkle Luka or any Miku"
          hint="What would you happily trade this for? Helps people make offers you'll like."
          error={errors.looking_for}
          defaultValue={v("looking_for")}
        />
      )}

      <TextAreaField
        label="Description"
        name="description"
        optional
        maxLength={1000}
        placeholder="Edition, any flaws, what's included (box, card, foil)…"
        hint="Be honest about flaws. It builds trust and avoids disputes."
        error={errors.description}
        defaultValue={v("description")}
      />

      <TextField
        label="Size or dimensions"
        name="size"
        optional
        maxLength={60}
        placeholder="e.g. 5 cm tall, 1.5 inch pin"
        error={errors.size}
        defaultValue={v("size")}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton pendingText={isEdit ? "Saving…" : "Posting…"} disabled={photosBusy}>
          {isEdit ? "Save changes" : "Post listing"}
        </SubmitButton>
        {photosBusy && <span className="text-sm text-muted">Waiting for photos to finish uploading…</span>}
      </div>
    </form>
  );
}
