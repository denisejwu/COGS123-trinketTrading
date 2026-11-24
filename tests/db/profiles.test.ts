import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, createUser, asUser, type Db } from "./harness";

let db: Db;

beforeAll(async () => {
  db = await createTestDb();
});

describe("profiles", () => {
  it("creates a profile automatically on sign-up", async () => {
    const id = await createUser(db, { username: "Luka_Fan", display_name: "Luka Fan" });
    const { rows } = await db.query<{ username: string; display_name: string; trades_completed: number }>(
      "select username, display_name, trades_completed from public.profiles where id = $1",
      [id],
    );
    // usernames are stored in lowercase
    expect(rows[0]).toEqual({ username: "luka_fan", display_name: "Luka Fan", trades_completed: 0 });
  });

  it("falls back to a generated username when the wanted one is taken", async () => {
    await createUser(db, { username: "pinqueen" });
    const second = await createUser(db, { username: "pinqueen" });
    const { rows } = await db.query<{ username: string }>(
      "select username from public.profiles where id = $1",
      [second],
    );
    expect(rows[0].username).toMatch(/^user_[a-f0-9]{10}$/);
  });

  it("lets a user edit their own profile but not someone else's", async () => {
    const me = await createUser(db);
    const other = await createUser(db);

    await asUser(db, me, (tx) =>
      tx.query("update public.profiles set bio = 'hi!' where id = $1", [me]),
    );
    const updatedOther = await asUser(db, me, (tx) =>
      tx.query("update public.profiles set bio = 'hacked' where id = $1", [other]),
    );

    const { rows } = await db.query<{ id: string; bio: string | null }>(
      "select id, bio from public.profiles where id = any($1)",
      [[me, other]],
    );
    expect(rows.find((r) => r.id === me)?.bio).toBe("hi!");
    expect(rows.find((r) => r.id === other)?.bio).toBeNull();
    expect(updatedOther.affectedRows).toBe(0); // RLS silently matched no rows
  });

  it("does not let users give themselves a fake trade count", async () => {
    const me = await createUser(db);
    await expect(
      asUser(db, me, (tx) =>
        tx.query("update public.profiles set trades_completed = 99 where id = $1", [me]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("checks username availability for logged-out visitors", async () => {
    await createUser(db, { username: "taken_name" });
    const result = await db.transaction(async (tx) => {
      await tx.exec("set local role anon");
      return tx.query<{ ok: boolean; free: boolean }>(
        "select public.username_available('TAKEN_NAME') as ok, public.username_available('free_name') as free",
      );
    });
    expect(result.rows[0]).toEqual({ ok: false, free: true });
  });

  it("only lets users upload avatars into their own folder", async () => {
    const me = await createUser(db);
    const other = await createUser(db);

    await asUser(db, me, (tx) =>
      tx.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${me}/a.jpg`]),
    );
    await expect(
      asUser(db, me, (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('avatars', $1)", [`${other}/a.jpg`]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});
