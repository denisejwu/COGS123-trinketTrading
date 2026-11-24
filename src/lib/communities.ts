import { Gift, Heart, KeyRound, Layers, Pin, Sparkles, Users, type LucideIcon } from "lucide-react";

/**
 * Communities without a cover photo get a soft colour and an icon.
 * The six starter communities have their own icons; others get one
 * picked from their name so it's always the same.
 */
const ICONS: Record<string, LucideIcon> = {
  "blind-boxes": Gift,
  "enamel-pins": Pin,
  keychains: KeyRound,
  "pokemon-cards": Sparkles,
  "trading-cards": Layers,
  plushies: Heart,
};

const PALETTE = [
  { bg: "#e8eefb", fg: "#2448ad" },
  { bg: "#fdecef", fg: "#a1264a" },
  { bg: "#e6f4ea", fg: "#17663a" },
  { bg: "#fff4d6", fg: "#8a5a00" },
  { bg: "#f1e8fb", fg: "#6b2fb3" },
  { bg: "#e3f4f7", fg: "#0f6577" },
];

function hash(text: string) {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

export function communityLook(slug: string) {
  return {
    Icon: ICONS[slug] ?? Users,
    colors: PALETTE[hash(slug) % PALETTE.length],
  };
}
