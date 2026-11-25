/**
 * Builds the virtual trinket catalog from scripts/catalog-data.mjs:
 *   public/catalog/<slug>.svg   one illustration per trinket
 *   public/avatars/<n>.svg      cute default profile pictures
 *   supabase/seed.sql           catalog rows (between the CATALOG markers)
 *
 *   npm run catalog
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { SERIES, slugify } from "./catalog-data.mjs";

const root = join(import.meta.dirname, "..");
const catalogDir = join(root, "public", "catalog");
const avatarDir = join(root, "public", "avatars");
mkdirSync(catalogDir, { recursive: true });
mkdirSync(avatarDir, { recursive: true });

// ---------------------------------------------------------------------------
// Drawing helpers (simple shapes, so the files stay tiny)
// ---------------------------------------------------------------------------
function ears(creature, color) {
  switch (creature) {
    case "bunny":
      return `<ellipse cx="82" cy="58" rx="13" ry="34" fill="${color}" stroke="#1b2541" stroke-width="3"/>
              <ellipse cx="118" cy="58" rx="13" ry="34" fill="${color}" stroke="#1b2541" stroke-width="3"/>
              <ellipse cx="82" cy="60" rx="6" ry="22" fill="#fbcfe8"/><ellipse cx="118" cy="60" rx="6" ry="22" fill="#fbcfe8"/>`;
    case "cat":
      return `<path d="M66 92 L74 52 L98 80 Z" fill="${color}" stroke="#1b2541" stroke-width="3" stroke-linejoin="round"/>
              <path d="M134 92 L126 52 L102 80 Z" fill="${color}" stroke="#1b2541" stroke-width="3" stroke-linejoin="round"/>`;
    case "bear":
      return `<circle cx="70" cy="70" r="16" fill="${color}" stroke="#1b2541" stroke-width="3"/>
              <circle cx="130" cy="70" r="16" fill="${color}" stroke="#1b2541" stroke-width="3"/>
              <circle cx="70" cy="70" r="7" fill="#f5c9a8"/><circle cx="130" cy="70" r="7" fill="#f5c9a8"/>`;
    case "frog":
      return `<circle cx="74" cy="76" r="17" fill="${color}" stroke="#1b2541" stroke-width="3"/>
              <circle cx="126" cy="76" r="17" fill="${color}" stroke="#1b2541" stroke-width="3"/>`;
    default:
      return "";
  }
}

function body(creature, color) {
  if (creature === "ghost") {
    return `<path d="M58 168 L58 112 Q58 62 100 62 Q142 62 142 112 L142 168 Q131 158 121 168 Q110 158 100 168 Q89 158 79 168 Q68 158 58 168 Z"
              fill="${color}" stroke="#1b2541" stroke-width="3" stroke-linejoin="round"/>`;
  }
  return `<ellipse cx="100" cy="150" rx="40" ry="22" fill="${color}" stroke="#1b2541" stroke-width="3"/>
          <circle cx="100" cy="108" r="42" fill="${color}" stroke="#1b2541" stroke-width="3"/>`;
}

function face(creature) {
  const eyeY = creature === "frog" ? 76 : 106;
  const eyes =
    creature === "frog"
      ? `<circle cx="74" cy="76" r="6" fill="#1b2541"/><circle cx="126" cy="76" r="6" fill="#1b2541"/>`
      : `<circle cx="86" cy="${eyeY}" r="5" fill="#1b2541"/><circle cx="114" cy="${eyeY}" r="5" fill="#1b2541"/>`;
  return `${eyes}
    <ellipse cx="78" cy="120" rx="8" ry="5" fill="#f9a8d4" opacity="0.8"/>
    <ellipse cx="122" cy="120" rx="8" ry="5" fill="#f9a8d4" opacity="0.8"/>
    <path d="M93 120 Q100 127 107 120" fill="none" stroke="#1b2541" stroke-width="3" stroke-linecap="round"/>`;
}

const ACCESSORIES = {
  nightcap: `<path d="M70 70 Q100 20 138 50 L130 74 Z" fill="#818cf8" stroke="#1b2541" stroke-width="3"/><circle cx="140" cy="50" r="7" fill="#fff" stroke="#1b2541" stroke-width="2"/>`,
  bubbles: `<circle cx="152" cy="62" r="9" fill="#e0f2fe" stroke="#38bdf8" stroke-width="2"/><circle cx="164" cy="40" r="6" fill="#e0f2fe" stroke="#38bdf8" stroke-width="2"/><circle cx="40" cy="70" r="7" fill="#e0f2fe" stroke="#38bdf8" stroke-width="2"/>`,
  flower: `<g transform="translate(140 72)"><circle r="7" cy="-9" fill="#f472b6"/><circle r="7" cx="9" fill="#f472b6"/><circle r="7" cy="9" fill="#f472b6"/><circle r="7" cx="-9" fill="#f472b6"/><circle r="6" fill="#fde047"/></g>`,
  umbrella: `<path d="M132 70 Q156 40 180 70 Z" fill="#60a5fa" stroke="#1b2541" stroke-width="3"/><line x1="156" y1="70" x2="156" y2="104" stroke="#1b2541" stroke-width="3"/>`,
  moon: `<path d="M160 40 A22 22 0 1 0 172 78 A17 17 0 1 1 160 40 Z" fill="#fde047" stroke="#1b2541" stroke-width="2"/>`,
  star: `<path d="M158 34 L164 50 L181 51 L168 61 L172 78 L158 69 L144 78 L148 61 L135 51 L152 50 Z" fill="#fde047" stroke="#1b2541" stroke-width="2" stroke-linejoin="round"/>`,
  crown: `<path d="M74 66 L80 42 L92 58 L100 38 L108 58 L120 42 L126 66 Z" fill="#facc15" stroke="#1b2541" stroke-width="3" stroke-linejoin="round"/><circle cx="100" cy="56" r="4" fill="#f43f5e"/>`,
  strawberry: `<path d="M150 60 Q170 60 166 84 Q158 100 150 100 Q142 100 134 84 Q130 60 150 60 Z" fill="#f43f5e" stroke="#1b2541" stroke-width="2"/><path d="M140 60 L150 52 L160 60 Z" fill="#22c55e"/>`,
  mushroom: `<path d="M134 74 Q150 46 168 74 Z" fill="#ef4444" stroke="#1b2541" stroke-width="2"/><rect x="146" y="74" width="9" height="16" rx="3" fill="#fef3c7" stroke="#1b2541" stroke-width="2"/>`,
  leaf: `<path d="M136 80 Q150 46 176 56 Q170 88 136 80 Z" fill="#22c55e" stroke="#1b2541" stroke-width="2"/>`,
  rainbow: `<path d="M126 82 A30 30 0 0 1 186 82" fill="none" stroke="#f43f5e" stroke-width="6"/><path d="M134 82 A22 22 0 0 1 178 82" fill="none" stroke="#facc15" stroke-width="6"/><path d="M142 82 A14 14 0 0 1 170 82" fill="none" stroke="#38bdf8" stroke-width="6"/>`,
  rocket: `<path d="M156 40 Q168 54 164 80 L148 80 Q144 54 156 40 Z" fill="#e2e8f0" stroke="#1b2541" stroke-width="2"/><circle cx="156" cy="58" r="5" fill="#38bdf8"/><path d="M150 80 L156 94 L162 80 Z" fill="#f97316"/>`,
  helmet: `<circle cx="100" cy="106" r="54" fill="#bae6fd" opacity="0.35" stroke="#1b2541" stroke-width="3"/>`,
  planet: `<circle cx="158" cy="62" r="14" fill="#a78bfa" stroke="#1b2541" stroke-width="2"/><ellipse cx="158" cy="62" rx="24" ry="6" fill="none" stroke="#1b2541" stroke-width="2"/>`,
  donut: `<circle cx="156" cy="76" r="17" fill="#f9a8d4" stroke="#1b2541" stroke-width="2"/><circle cx="156" cy="76" r="6" fill="#fef3c7" stroke="#1b2541" stroke-width="2"/>`,
  boba: `<rect x="142" y="58" width="26" height="38" rx="5" fill="#fde68a" stroke="#1b2541" stroke-width="2"/><line x1="158" y1="58" x2="166" y2="40" stroke="#1b2541" stroke-width="3"/><circle cx="150" cy="88" r="3" fill="#1b2541"/><circle cx="160" cy="88" r="3" fill="#1b2541"/>`,
  cookie: `<circle cx="156" cy="76" r="17" fill="#d6a46c" stroke="#1b2541" stroke-width="2"/><circle cx="150" cy="70" r="3" fill="#5b3a1e"/><circle cx="162" cy="78" r="3" fill="#5b3a1e"/><circle cx="152" cy="84" r="3" fill="#5b3a1e"/>`,
  pancake: `<ellipse cx="156" cy="88" rx="20" ry="6" fill="#f59e0b" stroke="#1b2541" stroke-width="2"/><ellipse cx="156" cy="80" rx="20" ry="6" fill="#fbbf24" stroke="#1b2541" stroke-width="2"/><rect x="150" y="70" width="10" height="7" fill="#fef9c3"/>`,
  heart: `<path d="M156 92 L140 76 Q134 64 146 60 Q154 58 156 66 Q158 58 166 60 Q178 64 172 76 Z" fill="#f43f5e" stroke="#1b2541" stroke-width="2"/>`,
  chefhat: `<path d="M74 70 Q66 46 86 46 Q92 30 108 36 Q124 30 128 48 Q140 52 126 70 Z" fill="#fff" stroke="#1b2541" stroke-width="3"/>`,
  bolt: `<path d="M160 36 L146 64 L158 64 L150 92 L172 58 L160 58 L168 36 Z" fill="#facc15" stroke="#1b2541" stroke-width="2" stroke-linejoin="round"/>`,
};

const RARITY_STYLE = {
  common: { ring: "#cbd5e1", label: "COMMON", text: "#475569" },
  uncommon: { ring: "#4ade80", label: "UNCOMMON", text: "#166534" },
  rare: { ring: "#60a5fa", label: "RARE", text: "#1e40af" },
  secret: { ring: "#facc15", label: "SECRET", text: "#854d0e" },
};

function trinketSvg(series, [name, rarity, accessory], index) {
  const style = RARITY_STYLE[rarity];
  const [c1, c2] = rarity === "secret" ? ["#fef3c7", "#fde68a"] : series.palette;
  const bodyColor = rarity === "secret" ? "#fcd34d" : series.body;
  const sparkles =
    rarity === "secret" || rarity === "rare"
      ? `<g fill="${rarity === "secret" ? "#f59e0b" : "#60a5fa"}" opacity="0.9">
           <path d="M28 30 l4 10 l10 4 l-10 4 l-4 10 l-4 -10 l-10 -4 l10 -4 Z"/>
           <path d="M172 150 l3 7 l7 3 l-7 3 l-3 7 l-3 -7 l-7 -3 l7 -3 Z"/>
         </g>`
      : "";
  const id = `g${index}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" aria-label="${name}">
  <defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs>
  <rect x="4" y="4" width="192" height="192" rx="28" fill="url(#${id})" stroke="${style.ring}" stroke-width="8"/>
  ${sparkles}
  ${ears(series.creature, bodyColor)}
  ${body(series.creature, bodyColor)}
  ${face(series.creature)}
  ${ACCESSORIES[accessory] ?? ""}
  <rect x="58" y="174" width="84" height="16" rx="8" fill="#ffffff" opacity="0.9"/>
  <text x="100" y="186" text-anchor="middle" font-family="Arial, sans-serif" font-size="10" font-weight="700" fill="${style.text}">${style.label}</text>
</svg>
`;
}

// ---------------------------------------------------------------------------
// Write the trinket art + catalog rows
// ---------------------------------------------------------------------------
const rows = [];
let index = 0;
for (const series of SERIES) {
  for (const item of series.items) {
    const [name, rarity] = item;
    const slug = slugify(`${series.name} ${name}`);
    writeFileSync(join(catalogDir, `${slug}.svg`), trinketSvg(series, item, index++));
    const esc = (s) => s.replace(/'/g, "''");
    rows.push(
      `  ('${slug}', '${esc(name)}', '${esc(series.name)}', '${series.form}', '${rarity}', '${esc(series.blurb)}', '/catalog/${slug}.svg')`,
    );
  }
}

// Default avatars: one cute face per creature + color.
const AVATAR_COLORS = ["#fde2ef", "#dcfce7", "#e0e7ff", "#fef3c7", "#e0f2fe", "#f1e8fb"];
let avatarCount = 0;
for (const series of SERIES) {
  for (const bg of AVATAR_COLORS.slice(0, 2)) {
    avatarCount++;
    writeFileSync(
      join(avatarDir, `${avatarCount}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="${bg}"/>
  <g transform="translate(0 6)">${ears(series.creature, series.body)}${body(series.creature, series.body)}${face(series.creature)}</g></svg>
`,
    );
  }
}

// Put the catalog rows into seed.sql between the markers.
const seedPath = join(root, "supabase", "seed.sql");
const seed = readFileSync(seedPath, "utf8").replace(/\r\n/g, "\n");
const block = `-- CATALOG:START (generated by npm run catalog; do not edit by hand)
insert into public.catalog_items (slug, name, series, form, rarity, blurb, image_path) values
${rows.join(",\n")}
on conflict (slug) do nothing;
-- CATALOG:END`;
const next = seed.includes("-- CATALOG:START")
  ? seed.replace(/-- CATALOG:START[\s\S]*-- CATALOG:END/, block)
  : `${seed.trimEnd()}\n\n-- ---- Virtual trinket catalog (starter packs) -------------------------\n${block}\n`;
writeFileSync(seedPath, next);

console.log(`Wrote ${rows.length} trinkets, ${avatarCount} avatars, and the catalog rows in seed.sql`);
