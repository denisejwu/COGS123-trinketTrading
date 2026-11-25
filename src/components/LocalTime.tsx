"use client";

import { useSyncExternalStore } from "react";

const noSubscribe = () => () => {};

const FORMATS: Record<"datetime" | "time", Intl.DateTimeFormatOptions> = {
  datetime: { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" },
  time: { hour: "numeric", minute: "2-digit" },
};

function format(iso: string, style: "datetime" | "time", timeZone?: string) {
  return new Intl.DateTimeFormat("en-US", { ...FORMATS[style], timeZone }).format(new Date(iso));
}

/**
 * Shows a date/time in the VIEWER's time zone, e.g. "Sat, Nov 29, 2:00 PM"
 * (or just "2:00 PM" with style="time").
 *
 * The server doesn't know your time zone, so it renders a neutral UTC
 * version first and the browser swaps in your local time. Using
 * useSyncExternalStore makes React expect that swap, so there's no
 * "server and browser didn't match" (hydration) error.
 */
export function LocalTime({ iso, style = "datetime" }: { iso: string; style?: "datetime" | "time" }) {
  const text = useSyncExternalStore(
    noSubscribe,
    () => format(iso, style),
    () => (style === "time" ? format(iso, style, "UTC") : `${format(iso, style, "UTC")} UTC`),
  );
  return <time dateTime={iso}>{text}</time>;
}
