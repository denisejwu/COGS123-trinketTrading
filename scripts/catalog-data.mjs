/**
 * The virtual trinket catalog used for starter packs.
 * 5 original series × 8 items (4 common, 2 uncommon, 1 rare, 1 secret).
 * All names and art are made up for PopSwap (no real brands).
 *
 * `npm run catalog` turns this into:
 *   public/catalog/<slug>.svg  (the artwork)
 *   rows in supabase/seed.sql   (the catalog table)
 */
export const SERIES = [
  {
    name: "Dreamy Bunnies",
    creature: "bunny",
    form: "Figure",
    blurb: "Soft-pastel bunny figures from a dreamland blind box.",
    palette: ["#fde2ef", "#e9d5ff"],
    body: "#ffffff",
    items: [
      ["Sleepy Bunny", "common", "nightcap"],
      ["Bubble Bunny", "common", "bubbles"],
      ["Picnic Bunny", "common", "flower"],
      ["Rainy Day Bunny", "common", "umbrella"],
      ["Moon Bunny", "uncommon", "moon"],
      ["Star Wish Bunny", "uncommon", "star"],
      ["Crown Bunny", "rare", "crown"],
      ["Golden Dream Bunny", "secret", "crown"],
    ],
  },
  {
    name: "Garden Frogs",
    creature: "frog",
    form: "Keychain",
    blurb: "Tiny frog keychains that hop around your bag.",
    palette: ["#dcfce7", "#bbf7d0"],
    body: "#86d39a",
    items: [
      ["Strawberry Frog", "common", "strawberry"],
      ["Mushroom Frog", "common", "mushroom"],
      ["Sunflower Frog", "common", "flower"],
      ["Puddle Frog", "common", "bubbles"],
      ["Lily Pad Frog", "uncommon", "leaf"],
      ["Rainbow Frog", "uncommon", "rainbow"],
      ["Royal Frog", "rare", "crown"],
      ["Crystal Frog", "secret", "star"],
    ],
  },
  {
    name: "Cosmic Cats",
    creature: "cat",
    form: "Pin",
    blurb: "Enamel pins of cats exploring outer space.",
    palette: ["#e0e7ff", "#c7d2fe"],
    body: "#fbbf8f",
    items: [
      ["Rocket Cat", "common", "rocket"],
      ["Comet Cat", "common", "star"],
      ["Astronaut Cat", "common", "helmet"],
      ["Planet Cat", "common", "planet"],
      ["Nebula Cat", "uncommon", "moon"],
      ["Satellite Cat", "uncommon", "planet"],
      ["Galaxy Cat", "rare", "crown"],
      ["Supernova Cat", "secret", "star"],
    ],
  },
  {
    name: "Snack Bears",
    creature: "bear",
    form: "Plush",
    blurb: "Squishy bear plushies that love snacks.",
    palette: ["#fef3c7", "#fed7aa"],
    body: "#c08457",
    items: [
      ["Donut Bear", "common", "donut"],
      ["Boba Bear", "common", "boba"],
      ["Cookie Bear", "common", "cookie"],
      ["Pancake Bear", "common", "pancake"],
      ["Mochi Bear", "uncommon", "heart"],
      ["Sundae Bear", "uncommon", "strawberry"],
      ["Chef Bear", "rare", "chefhat"],
      ["Golden Honey Bear", "secret", "crown"],
    ],
  },
  {
    name: "Cloud Ghosts",
    creature: "ghost",
    form: "Trading card",
    blurb: "Friendly ghost trading cards that float in the clouds.",
    palette: ["#e0f2fe", "#bae6fd"],
    body: "#ffffff",
    items: [
      ["Pillow Ghost", "common", "nightcap"],
      ["Teacup Ghost", "common", "heart"],
      ["Kite Ghost", "common", "star"],
      ["Snowflake Ghost", "common", "bubbles"],
      ["Thunder Ghost", "uncommon", "bolt"],
      ["Aurora Ghost", "uncommon", "rainbow"],
      ["Lantern Ghost", "rare", "crown"],
      ["Starlight Ghost", "secret", "star"],
    ],
  },
];

export const slugify = (text) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
