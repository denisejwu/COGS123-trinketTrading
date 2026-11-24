/**
 * Test harness: spins up an in-memory Postgres (PGlite), loads a small
 * Supabase imitation, then runs every file in supabase/migrations in order.
 *
 * That means the tests exercise the exact same SQL you run on Supabase,
 * including Row Level Security, without needing Docker, network or keys.
 */
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(__dirname, "..", "..");
const migrationsDir = join(root, "supabase", "migrations");

export type Db = PGlite;

/** Create a fresh database with the shim + all migrations applied. */
export async function createTestDb(options: { seed?: boolean } = {}): Promise<Db> {
  const db = new PGlite();
  await db.exec(readFileSync(join(__dirname, "supabase-shim.sql"), "utf8"));

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  for (const file of files) {
    try {
      await db.exec(readFileSync(join(migrationsDir, file), "utf8"));
    } catch (error) {
      throw new Error(`Migration ${file} failed: ${(error as Error).message}`);
    }
  }

  if (options.seed) {
    await db.exec(readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  }
  return db;
}

let counter = 0;

/** Sign up a fake user (like Supabase Auth would) and return their id. */
export async function createUser(
  db: Db,
  meta: { username?: string; display_name?: string; location?: string } = {},
): Promise<string> {
  counter += 1;
  const username = meta.username ?? `tester${counter}`;
  const result = await db.query<{ id: string }>(
    `insert into auth.users (email, raw_user_meta_data)
     values ($1, $2) returning id`,
    [`${username}@example.com`, JSON.stringify({ username, display_name: meta.display_name ?? username })],
  );
  const id = result.rows[0].id;
  if (meta.location) {
    await db.query(`update public.profiles set location = $1 where id = $2`, [meta.location, id]);
  }
  return id;
}

/**
 * Run some queries *as a logged-in user*, exactly like a request from the
 * app would: role = authenticated, auth.uid() = userId, RLS enforced.
 * Everything runs in a transaction that is rolled back if it throws.
 */
export async function asUser<T>(
  db: Db,
  userId: string,
  fn: (tx: Transaction) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.exec("set local role authenticated");
    await tx.query("select set_config('request.jwt.claims', $1, true)", [
      JSON.stringify({ sub: userId, role: "authenticated" }),
    ]);
    return fn(tx);
  });
}

/** Call a Postgres function (RPC) as a user, e.g. rpc(db, alice, 'accept_offer', { p_offer_id }). */
export async function rpc<T = unknown>(
  db: Db,
  userId: string,
  fnName: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const names = Object.keys(args);
  const params = names.map((name, i) => `${name} => $${i + 1}`).join(", ");
  return asUser(db, userId, async (tx) => {
    const result = await tx.query<{ result: T }>(
      `select public.${fnName}(${params}) as result`,
      names.map((n) => args[n]),
    );
    return result.rows[0]?.result as T;
  });
}
