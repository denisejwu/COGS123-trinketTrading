/**
 * Supabase setup, done for you:
 *   1. runs every migration your database doesn't have yet (in order)
 *   2. adds the starter data (seed.sql; safe to run again)
 *   3. tries to turn on name-only sign-in ("anonymous sign-ins")
 *
 *   npm run db:setup
 *
 * It needs a Supabase *personal access token* in the file .env.setup:
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 * Create one at https://supabase.com/dashboard/account/tokens (permission:
 * Database → write), run this, then DELETE the token there.
 * .env.setup is ignored by git, so the token never gets uploaded.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const token = process.env.SUPABASE_ACCESS_TOKEN?.trim();
const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

if (!token || !token.startsWith("sbp_")) {
  console.log("\n✘ No access token found. Put SUPABASE_ACCESS_TOKEN=sbp_... in the file .env.setup and save it.\n");
  process.exit(1);
}
if (!projectUrl) {
  console.log("\n✘ NEXT_PUBLIC_SUPABASE_URL is missing from .env.local.\n");
  process.exit(1);
}

// "https://abcd.supabase.co" -> "abcd" (the project's id)
const ref = new URL(projectUrl).hostname.split(".")[0];
const api = `https://api.supabase.com/v1/projects/${ref}`;
const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

async function call(method, path, body) {
  const res = await fetch(`${api}${path}`, { method, headers, body: JSON.stringify(body) });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 500)}`);
  return text ? JSON.parse(text) : null;
}
const sql = (query) => call("POST", "/database/query", { query });

console.log(`\nSetting up Supabase project ${ref}\n`);

// 1. Migrations. Each file's first "create table public.X" tells us whether
//    it has already been run (if X exists, we skip the file).
const migrationsDir = join(root, "supabase", "migrations");
try {
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    const body = readFileSync(join(migrationsDir, file), "utf8");
    const marker = body.match(/create table public\.(\w+)/i)?.[1];
    const [check] = marker
      ? await sql(`select to_regclass('public.${marker}') is not null as installed`)
      : [{ installed: false }];
    if (check?.installed) {
      console.log(`  ✔ ${file} (already installed)`);
      continue;
    }
    // One transaction per file: if it fails, nothing from that file is kept.
    await sql(`begin;\n${body}\ncommit;`);
    console.log(`  ✔ ${file} (installed now)`);
  }
} catch (error) {
  console.log(`  ✘ Migration failed: ${error.message}`);
  process.exit(1);
}

// 2. Starter data (skips anything that already exists).
try {
  await sql(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  console.log("  ✔ Starter communities and events are in");
} catch (error) {
  console.log(`  ✘ Seed data failed: ${error.message}`);
}

// 3. Name-only sign-in (needs a token with project admin permission).
try {
  await call("PATCH", "/config/auth", { external_anonymous_users_enabled: true });
  console.log("  ✔ Name-only sign-in (anonymous sign-ins) is on");
} catch {
  console.log("  • Couldn't change sign-in settings with this token. If it isn't on yet, turn it on by hand:");
  console.log("    Authentication → Sign In / Providers → Allow anonymous sign-ins.");
}

console.log(
  "\nDone! Now delete the access token at https://supabase.com/dashboard/account/tokens" +
    "\nand remove it from .env.setup. Run `npm run check:supabase` to double-check.\n",
);
