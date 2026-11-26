/** Room chat and direct messages (0007). */
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, createUser, asUser, rpc, type Db } from "./harness";

let db: Db;
let community: string;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
  const { rows } = await db.query<{ id: string }>("select id from public.communities where slug = 'blind-boxes'");
  community = rows[0].id;
});

async function member() {
  const id = await createUser(db);
  await db.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [community, id]);
  return id;
}

describe("room chat", () => {
  it("members can chat; outsiders can't read or post", async () => {
    const a = await member();
    const outsider = await createUser(db);
    await asUser(db, a, (tx) =>
      tx.query("insert into public.room_messages (community_id, sender_id, body) values ($1, $2, 'Hi room!')", [community, a]),
    );
    const seen = await asUser(db, outsider, (tx) =>
      tx.query("select id from public.room_messages where community_id = $1", [community]),
    );
    expect(seen.rows).toHaveLength(0);
    await expect(
      asUser(db, outsider, (tx) =>
        tx.query("insert into public.room_messages (community_id, sender_id, body) values ($1, $2, 'let me in')", [community, outsider]),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("direct messages", () => {
  it("one thread per pair, private to the two people, with unread counts", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const outsider = await createUser(db);

    const t1 = await rpc<string>(db, a, "start_direct_chat", { p_other: b });
    const t2 = await rpc<string>(db, b, "start_direct_chat", { p_other: a });
    expect(t1).toBe(t2); // same thread from either side

    await asUser(db, a, (tx) =>
      tx.query("insert into public.direct_messages (thread_id, sender_id, body) values ($1, $2, 'Hey! Want to trade?')", [t1, a]),
    );
    expect(await rpc<number>(db, b, "unread_chat_count")).toBe(1);
    expect(await rpc<number>(db, a, "unread_chat_count")).toBe(0); // you've read your own message
    await rpc(db, b, "mark_thread_read", { p_thread_id: t1 });
    expect(await rpc<number>(db, b, "unread_chat_count")).toBe(0);

    const peek = await asUser(db, outsider, (tx) => tx.query("select id from public.direct_messages where thread_id = $1", [t1]));
    expect(peek.rows).toHaveLength(0);
    await expect(
      asUser(db, outsider, (tx) =>
        tx.query("insert into public.direct_messages (thread_id, sender_id, body) values ($1, $2, 'hi')", [t1, outsider]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("can't message yourself", async () => {
    const a = await createUser(db);
    await expect(rpc(db, a, "start_direct_chat", { p_other: a })).rejects.toThrow(/can't message/);
  });
});
