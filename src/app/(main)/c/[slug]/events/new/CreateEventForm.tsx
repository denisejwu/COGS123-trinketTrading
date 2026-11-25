"use client";

import { useActionState, useState } from "react";
import { createEvent } from "@/app/(main)/events/actions";
import { TextAreaField, TextField } from "@/components/ui/Field";
import { FormMessage } from "@/components/ui/Notice";
import { SubmitButton } from "@/components/ui/SubmitButton";
import { EVENT_TYPES, type EventType } from "@/lib/event-types";
import { initialFormState } from "@/lib/validation";

/** Today + 1 hour, rounded, in the "YYYY-MM-DDTHH:MM" format date inputs want. */
function defaultStart() {
  const d = new Date(Date.now() + 60 * 60 * 1000);
  d.setMinutes(0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:00`;
}

export function CreateEventForm({ communityId, slug }: { communityId: string; slug: string }) {
  const [state, formAction] = useActionState(createEvent, initialFormState);
  const [type, setType] = useState<EventType>((state.values?.type as EventType) || "swap_meet");
  const [localStart, setLocalStart] = useState(state.values?.starts_at ? "" : defaultStart());
  const errors = state.fieldErrors ?? {};
  const meta = EVENT_TYPES[type];

  // The date input gives local time without a time zone. We convert it to a
  // full timestamp here in the browser, which knows your time zone.
  const startsAtIso = localStart ? new Date(localStart).toISOString() : "";

  return (
    <form action={formAction} className="space-y-6" noValidate>
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="starts_at" value={startsAtIso} />
      <FormMessage state={state} />

      <fieldset className="space-y-2">
        <legend className="text-sm font-bold">What kind of event?</legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {(Object.keys(EVENT_TYPES) as EventType[]).map((key) => {
            const option = EVENT_TYPES[key];
            const Icon = option.icon;
            return (
              <label
                key={key}
                className="flex cursor-pointer gap-3 rounded-2xl border border-line bg-card p-3 has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-accent"
              >
                <input
                  type="radio"
                  name="type"
                  value={key}
                  checked={type === key}
                  onChange={() => setType(key)}
                  className="sr-only"
                />
                <span
                  aria-hidden="true"
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: option.color.bg, color: option.color.fg }}
                >
                  <Icon size={20} />
                </span>
                <span>
                  <span className="block text-sm font-bold">{option.label}</span>
                  <span className="block text-xs text-muted">{option.tagline}</span>
                </span>
              </label>
            );
          })}
        </div>
        {errors.type && <p className="text-xs font-semibold text-danger">{errors.type}</p>}
      </fieldset>

      <TextField
        key={`title-${type}`}
        label="Title"
        name="title"
        required
        maxLength={80}
        defaultValue={state.values?.title || meta.defaultTitle}
        error={errors.title}
      />

      {meta.usesTheme && (
        <TextField
          label="Theme"
          name="theme"
          optional
          maxLength={80}
          placeholder={type === "theme_day" ? "e.g. Sanrio, Pastel, Kawaii food" : "e.g. Best display shelf"}
          hint={type === "theme_day" ? "Only items that fit the theme go on the shelf." : "What people should enter."}
          error={errors.theme}
          defaultValue={state.values?.theme}
        />
      )}

      <div className="space-y-1.5">
        <label htmlFor="field-starts" className="block text-sm font-bold">
          Date and time
        </label>
        <input
          id="field-starts"
          type="datetime-local"
          required
          value={localStart}
          onChange={(e) => setLocalStart(e.target.value)}
          aria-describedby="starts-hint"
          className="block w-full rounded-2xl border border-line bg-card px-4 py-2.5 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/30"
        />
        <p id="starts-hint" className="text-xs text-muted">
          Shown to everyone in their own time zone. You can start the event any time from its page.
        </p>
        {errors.starts_at && <p className="text-xs font-semibold text-danger">{errors.starts_at}</p>}
      </div>

      <TextField
        label="Place"
        name="place"
        optional
        maxLength={120}
        placeholder="In the PopSwap room"
        hint="Leave empty for an online event in the app, or add a real place for a meetup."
        error={errors.place}
        defaultValue={state.values?.place}
      />

      <TextAreaField
        label="Description"
        name="description"
        optional
        maxLength={1000}
        placeholder="What should people know or bring?"
        error={errors.description}
        defaultValue={state.values?.description}
      />

      <TextField
        label="Mini activity"
        name="mini_activity"
        optional
        maxLength={300}
        placeholder="e.g. Trade Bingo, Guess the Pull, Leave a note"
        hint="A small game or challenge to get people talking."
        error={errors.mini_activity}
        defaultValue={state.values?.mini_activity}
      />

      <SubmitButton pendingText="Creating…" disabled={!startsAtIso}>
        Create event
      </SubmitButton>
    </form>
  );
}
