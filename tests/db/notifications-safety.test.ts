/** Notifications and safety (0008). */
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, createUser, asUser, rpc, type Db } from "./harness";

let db: Db;
let community: string;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
  const { rows } = await db.query<{ id: string }>("select id from public.communities where slug = 'blind-boxes'");
  community = rows[0].id;
});

async function pack(user: string) {
  return rpc<string[]>(db, user, "claim_starter_pack", { p_community_id: community });
}

async function notes(user: string) {
  const { rows } = await asUser(db, user, (tx) =>
    tx.query<{ type: string; body: string; link: string }>(
      "select type, body, link from public.notifications order by created_at",
    ),
  );
  return rows;
}

describe("notifications", () => {
  it("covers the whole trade: offer, message, accept, confirm, complete, review", async () => {
    const a = await createUser(db, { display_name: "Ava" });
    const b = await createUser(db, { display_name: "Ben" });
    const [aItem] = await pack(a);
    const [bItem] = await pack(b);

    const offerId = await rpc<string>(db, b, "start_offer", { p_listing_id: aItem, p_listing_ids: [bItem] });
    await asUser(db, a, (tx) =>
      tx.query("insert into public.trade_messages (offer_id, sender_id, body) values ($1, $2, 'Deal?')", [offerId, a]),
    );
    const tradeId = await rpc<string>(db, a, "accept_offer", { p_offer_id: offerId });
    await rpc(db, a, "confirm_swap", { p_trade_id: tradeId });
    await rpc(db, b, "confirm_swap", { p_trade_id: tradeId });
    await rpc(db, a, "leave_review", { p_trade_id: tradeId, p_rating: 5 });

    const forA = (await notes(a)).map((n) => n.type);
    const forB = (await notes(b)).map((n) => n.type);
    expect(forA).toEqual(["new_offer", "swap_completed"]);
    expect(forB).toEqual(["trade_message", "offer_accepted", "swap_confirmed", "swap_completed", "new_review"]);
  });

  it("only you can see and mark your notifications", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await asUser(db, a, (tx) => tx.query("insert into public.friends (user_id, friend_id) values ($1, $2)", [a, b]));
    expect((await notes(b)).map((n) => n.type)).toEqual(["new_friend"]);
    expect(await notes(a)).toEqual([]);

    // b marks it read; a can't touch b's notifications.
    const marked = await asUser(db, b, (tx) => tx.query("update public.notifications set read_at = now() where user_id = $1", [b]));
    expect(marked.affectedRows).toBe(1);
    const sneaky = await asUser(db, a, (tx) => tx.query("update public.notifications set read_at = null where user_id = $1", [b]));
    expect(sneaky.affectedRows).toBe(0);
  });
});

describe("blocking", () => {
  it("blocked people can't send offers or messages", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const [aItem] = await pack(a);
    const [bItem] = await pack(b);
    const thread = await rpc<string>(db, b, "start_direct_chat", { p_other: a });

    await asUser(db, a, (tx) => tx.query("insert into public.blocks (blocker_id, blocked_id) values ($1, $2)", [a, b]));

    await expect(rpc(db, b, "start_offer", { p_listing_id: aItem, p_listing_ids: [bItem] })).rejects.toThrow(/can't trade/);
    await expect(
      asUser(db, b, (tx) =>
        tx.query("insert into public.direct_messages (thread_id, sender_id, body) values ($1, $2, 'hi')", [thread, b]),
      ),
    ).rejects.toThrow(/can't message/);
  });

  it("reports are private to the person who filed them", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    await asUser(db, a, (tx) =>
      tx.query("insert into public.reports (reporter_id, reported_user_id, reason) values ($1, $2, 'Rude in chat')", [a, b]),
    );
    const seenByB = await asUser(db, b, (tx) => tx.query("select id from public.reports"));
    expect(seenByB.rows).toHaveLength(0);
  });
});
