/**
 * Checks that the app can reach your Supabase project and which
 * migrations have been run. Uses ONLY the publishable key from .env.local.
 *
 *   npm run check:supabase
 */
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

let failures = 0;
const ok = (msg) => console.log(`  ✔ ${msg}`);
const bad = (msg) => {
  failures += 1;
  console.log(`  ✘ ${msg}`);
};

console.log("\nPopSwap → Supabase connection check\n");

// 1. Settings present
if (!url || !key) {
  bad("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY missing from .env.local");
  process.exit(1);
}
ok(`Settings found for ${url}`);

// 2. Auth service reachable and key accepted
const health = await fetch(`${url}/auth/v1/health`, { headers: { apikey: key } }).catch((e) => e);
if (health instanceof Error) bad(`Couldn't reach Supabase: ${health.message}`);
else if (health.ok) ok("Auth service is reachable and accepted the publishable key");
else bad(`Auth service answered ${health.status} (is the key correct?)`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

// 3. Migration 0001 (profiles): username_available() is callable when logged out.
const { data: free, error: rpcError } = await supabase.rpc("username_available", { name: "popswap_check" });
if (rpcError) bad(`0001_profiles.sql not detected (${rpcError.code ?? ""} ${rpcError.message})`);
else ok(`0001_profiles.sql is installed (username_available answered ${free})`);

// 4. Migrations 0002 (communities/listings) and 0003 (negotiation): the
//    tables exist. Logged-out visitors see no rows because of Row Level
//    Security, which is expected.
for (const table of ["communities", "listings", "community_posts", "offers", "trade_messages", "listing_wants"]) {
  const { data, error } = await supabase.from(table).select("id").limit(1);
  if (error) bad(`Table "${table}" not found (${error.code ?? ""} ${error.message})`);
  else ok(`Table "${table}" exists (logged-out visitors see ${data.length} rows: RLS is protecting it)`);
}

// 5. Storage buckets: "Object not found" means the bucket exists.
for (const bucket of ["avatars", "listing-images", "community-covers"]) {
  const res = await fetch(`${url}/storage/v1/object/public/${bucket}/__popswap_check__.jpg`, {
    headers: { apikey: key },
  });
  const body = await res.text();
  if (/bucket not found/i.test(body)) bad(`Storage bucket "${bucket}" is missing`);
  else ok(`Storage bucket "${bucket}" exists`);
}

console.log(failures === 0 ? "\nAll checks passed.\n" : `\n${failures} check(s) failed. See the README for setup steps.\n`);
process.exit(failures === 0 ? 0 : 1);
