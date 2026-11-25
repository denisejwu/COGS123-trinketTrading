/**
 * One-time Supabase setup, done for you:
 *   1. creates all tables, rules and storage buckets (supabase/setup-all.sql)
 *   2. turns on name-only sign-in ("anonymous sign-ins")
 *
 *   npm run db:setup
 *
 * It needs a Supabase *personal access token* in the file .env.setup:
 *   SUPABASE_ACCESS_TOKEN=sbp_...
 * Create one at https://supabase.com/dashboard/account/tokens, run this
 * once, then DELETE the token there (it can manage your whole account).
 * .env.setup is ignored by git, so the token never gets uploaded.
 */
import { readFileSync } from "node:fs";
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

console.log(`\nSetting up Supabase project ${ref}\n`);

// 1. Tables (skipped if they already exist, so running twice is safe).
try {
  const [check] = await call("POST", "/database/query", {
    query: "select to_regclass('public.profiles') is not null as installed",
  });
  if (check?.installed) {
    console.log("  ✔ Tables already exist, skipping the database step");
  } else {
    const sql = readFileSync(join(root, "supabase", "setup-all.sql"), "utf8");
    await call("POST", "/database/query", { query: sql });
    console.log("  ✔ Created the tables, security rules, storage buckets and starter communities");
  }
} catch (error) {
  console.log(`  ✘ Database step failed: ${error.message}`);
  process.exit(1);
}

// 2. Name-only sign-in.
try {
  await call("PATCH", "/config/auth", { external_anonymous_users_enabled: true });
  console.log("  ✔ Turned on name-only sign-in (anonymous sign-ins)");
} catch (error) {
  console.log(`  ✘ Couldn't turn on name-only sign-in: ${error.message}`);
  console.log("    Do it by hand: Authentication → Sign In / Providers → Allow anonymous sign-ins.");
}

console.log(
  "\nDone! Now delete the access token at https://supabase.com/dashboard/account/tokens" +
    "\nand remove it from .env.setup. Run `npm run check:supabase` to double-check.\n",
);
