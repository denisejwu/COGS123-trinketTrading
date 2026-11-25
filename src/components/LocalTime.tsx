"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

function format(iso: string, timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(iso));
}

/**
 * Shows a date/time in the VIEWER's time zone, e.g. "Sat, Nov 29, 2:00 PM".
 * The server doesn't know your time zone, so it first renders UTC and the
 * browser swaps in your local time right away.
 */
export function LocalTime({ iso }: { iso: string }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => format(iso),
    () => `${format(iso, "UTC")} UTC`,
  );
  return <time dateTime={iso}>{text}</time>;
}
