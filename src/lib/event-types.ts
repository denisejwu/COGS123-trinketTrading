import { Gift, PackageOpen, Palette, Store, Trophy, type LucideIcon } from "lucide-react";
import type { Enums } from "@/lib/database.types";

export type EventType = Enums<"event_type">;
export type EventStatus = Enums<"event_status">;

/**
 * Everything the app needs to know about each kind of community event:
 * its name, icon, a one-line pitch, the steps ("how it works"), and what
 * the "add" button says.
 */
export const EVENT_TYPES: Record<
  EventType,
  {
    label: string;
    icon: LucideIcon;
    tagline: string;
    steps: string[];
    addLabel: string;
    defaultTitle: string;
    usesTheme: boolean;
    color: { bg: string; fg: string };
  }
> = {
  swap_meet: {
    label: "Swap Meet",
    icon: Store,
    tagline: "Bring items to a shared table and trade live with everyone in the room.",
    steps: [
      "Tap “Bring an item” to put your tradeable items on the table.",
      "Browse the table, heart what you like, and make offers like usual.",
      "Swaps happen in the normal swap rooms.",
    ],
    addLabel: "Bring an item",
    defaultTitle: "Swap Meet",
    usesTheme: false,
    color: { bg: "#e8eefb", fg: "#2448ad" },
  },
  mystery_swap: {
    label: "Mystery Swap",
    icon: Gift,
    tagline: "Everyone puts one item in a secret pool. Shuffle, reveal, surprise!",
    steps: [
      "Put ONE of your tradeable items in the pool. It's locked until the reveal.",
      "Items in the pool stay secret until the host taps “Shuffle & reveal”.",
      "Every item goes to someone random in the pool, never back to its owner.",
    ],
    addLabel: "Put an item in the pool",
    defaultTitle: "Mystery Swap",
    usesTheme: false,
    color: { bg: "#f1e8fb", fg: "#6b2fb3" },
  },
  unboxing_party: {
    label: "Unboxing Party",
    icon: PackageOpen,
    tagline: "Open blind boxes together and post what you pulled.",
    steps: [
      "Open your box and post a photo of your pull with a caption.",
      "Heart other people's pulls.",
      "Guess the Pull: post the box first, and let people guess in the community discussion.",
    ],
    addLabel: "Post your pull",
    defaultTitle: "Unboxing Party",
    usesTheme: false,
    color: { bg: "#fff4d6", fg: "#8a5a00" },
  },
  showcase_contest: {
    label: "Showcase Contest",
    icon: Trophy,
    tagline: "Enter your best item. Everyone gets one vote. Most votes wins.",
    steps: [
      "Enter ONE item you're proud of (it can be a showcase item).",
      "When the host starts the contest, everyone gets one vote.",
      "When the host ends it, the entry with the most votes wins the crown.",
    ],
    addLabel: "Enter an item",
    defaultTitle: "Showcase Contest",
    usesTheme: true,
    color: { bg: "#fdecef", fg: "#a1264a" },
  },
  theme_day: {
    label: "Themed Trading Day",
    icon: Palette,
    tagline: "A trading day with a theme. Only matching items on the shelf.",
    steps: [
      "Check today's theme.",
      "Add your tradeable items that fit the theme to the shelf.",
      "Browse the shelf and make offers like usual.",
    ],
    addLabel: "Add to the shelf",
    defaultTitle: "Themed Trading Day",
    usesTheme: true,
    color: { bg: "#e6f4ea", fg: "#17663a" },
  },
};

export const EVENT_STATUS_LABEL: Record<EventStatus, { label: string; className: string }> = {
  upcoming: { label: "Upcoming", className: "bg-accent-soft text-accent" },
  live: { label: "Live now", className: "bg-success text-white" },
  ended: { label: "Ended", className: "bg-cream text-muted" },
};

export function isEventType(value: unknown): value is EventType {
  return typeof value === "string" && value in EVENT_TYPES;
}
