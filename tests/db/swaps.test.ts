/**
 * Phase 4 rules: confirming a virtual swap (both must confirm), items
 * changing owners, cancelling, reviews and friends.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, createUser, asUser, rpc, type Db } from "./harness";

let db: Db;
let community: string;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
  const { rows } = await db.query<{ id: string }>("select id from public.communities where slug = 'blind-boxes'");
  community = rows[0].id;
});

async function listing(userId: string, title: string) {
  return rpc<string>(db, userId, "create_listing", {
    p_community_id: community,
    p_title: title,
    p_description: "",
    p_condition: "like_new",
    p_rarity: "common",
    p_size: "",
    p_looking_for: "",
    p_for_trade: true,
    p_image_paths: [`${userId}/${title.replace(/\W/g, "")}.jpg`],
  });
}

/** Two people, one item each, an accepted offer. Returns everything. */
async function acceptedTrade() {
  const owner = await createUser(db);
  const trader = await createUser(db);
  const ownerItem = await listing(owner, "Owner item");
  const traderItem = await listing(trader, "Trader item");
  const offerId = await rpc<string>(db, trader, "start_offer", {
    p_listing_id: ownerItem,
    p_listing_ids: [traderItem],
  });
  const tradeId = await rpc<string>(db, owner, "accept_offer", { p_offer_id: offerId });
  return { owner, trader, ownerItem, traderItem, offerId, tradeId };
}

async function row<T>(sql: string, params: unknown[]) {
  const { rows } = await db.query<T>(sql, params);
  return rows[0];
}

describe("confirming a swap", () => {
  it("needs BOTH people to confirm before anything changes", async () => {
    const t = await acceptedTrade();

    const afterOne = await rpc<string>(db, t.owner, "confirm_swap", { p_trade_id: t.tradeId });
    expect(afterOne).toBe("planning");
    const stillMine = await row<{ owner_id: string; status: string }>(
      "select owner_id, status from public.listings where id = $1",
      [t.ownerItem],
    );
    expect(stillMine).toEqual({ owner_id: t.owner, status: "pending" });

    // Confirming twice doesn't count as the other person.
    expect(await rpc<string>(db, t.owner, "confirm_swap", { p_trade_id: t.tradeId })).toBe("planning");

    const afterBoth = await rpc<string>(db, t.trader, "confirm_swap", { p_trade_id: t.tradeId });
    expect(afterBoth).toBe("completed");
  });

  it("moves each item to the other person's showcase and records the journey", async () => {
    const t = await acceptedTrade();
    await rpc(db, t.owner, "confirm_swap", { p_trade_id: t.tradeId });
    await rpc(db, t.trader, "confirm_swap", { p_trade_id: t.tradeId });

    const ownerItem = await row<{ owner_id: string; status: string; for_trade: boolean }>(
      "select owner_id, status, for_trade from public.listings where id = $1",
      [t.ownerItem],
    );
    expect(ownerItem).toEqual({ owner_id: t.trader, status: "available", for_trade: false });
    const traderItem = await row<{ owner_id: string }>("select owner_id from public.listings where id = $1", [t.traderItem]);
    expect(traderItem.owner_id).toBe(t.owner);

    const journey = await row<{ from_user: string; to_user: string }>(
      "select from_user, to_user from public.listing_transfers where listing_id = $1",
      [t.ownerItem],
    );
    expect(journey).toEqual({ from_user: t.owner, to_user: t.trader });

    const counts = await db.query<{ trades_completed: number }>(
      "select trades_completed from public.profiles where id = any($1)",
      [[t.owner, t.trader]],
    );
    expect(counts.rows.map((r) => r.trades_completed)).toEqual([1, 1]);
  });

  it("the new owner can edit the item and keep its photos", async () => {
    const t = await acceptedTrade();
    await rpc(db, t.owner, "confirm_swap", { p_trade_id: t.tradeId });
    await rpc(db, t.trader, "confirm_swap", { p_trade_id: t.tradeId });

    const oldPhoto = `${t.owner}/Owneritem.jpg`;
    await rpc(db, t.trader, "update_listing", {
      p_listing_id: t.ownerItem,
      p_community_id: community,
      p_title: "Owner item (now mine)",
      p_description: "",
      p_condition: "like_new",
      p_rarity: "common",
      p_size: "",
      p_looking_for: "",
      p_for_trade: true,
      p_image_paths: [oldPhoto],
    });
    const { rows } = await db.query<{ path: string }>("select path from public.listing_images where listing_id = $1", [t.ownerItem]);
    expect(rows).toEqual([{ path: oldPhoto }]);
  });

  it("outsiders can't confirm or cancel someone else's swap", async () => {
    const t = await acceptedTrade();
    const outsider = await createUser(db);
    await expect(rpc(db, outsider, "confirm_swap", { p_trade_id: t.tradeId })).rejects.toThrow(/not found/);
    await expect(rpc(db, outsider, "cancel_trade", { p_trade_id: t.tradeId })).rejects.toThrow(/not found/);
    const seen = await asUser(db, outsider, (tx) => tx.query("select id from public.trades where id = $1", [t.tradeId]));
    expect(seen.rows).toHaveLength(0);
  });

  it("cancelling puts the items back to available", async () => {
    const t = await acceptedTrade();
    await rpc(db, t.trader, "cancel_trade", { p_trade_id: t.tradeId });
    for (const id of [t.ownerItem, t.traderItem]) {
      const item = await row<{ status: string; owner_id: string }>("select status, owner_id from public.listings where id = $1", [id]);
      expect(item.status).toBe("available");
    }
    await expect(rpc(db, t.owner, "confirm_swap", { p_trade_id: t.tradeId })).rejects.toThrow(/already cancelled/);
  });
});

describe("reviews", () => {
  it("only after completion, once per person, and it updates the rating", async () => {
    const t = await acceptedTrade();
    await expect(
      rpc(db, t.owner, "leave_review", { p_trade_id: t.tradeId, p_rating: 5 }),
    ).rejects.toThrow(/once the swap is complete/);

    await rpc(db, t.owner, "confirm_swap", { p_trade_id: t.tradeId });
    await rpc(db, t.trader, "confirm_swap", { p_trade_id: t.tradeId });

    await rpc(db, t.owner, "leave_review", {
      p_trade_id: t.tradeId,
      p_rating: 4,
      p_tags: ["trustworthy", "as_described"],
      p_comment: "Smooth swap!",
    });
    await expect(
      rpc(db, t.owner, "leave_review", { p_trade_id: t.tradeId, p_rating: 1 }),
    ).rejects.toThrow(/already reviewed/);

    const trader = await row<{ rating_count: number; rating_avg: string }>(
      "select rating_count, rating_avg from public.profiles where id = $1",
      [t.trader],
    );
    expect(trader.rating_count).toBe(1);
    expect(Number(trader.rating_avg)).toBe(4);
  });

  it("rejects made-up tags and out-of-range stars", async () => {
    const t = await acceptedTrade();
    await rpc(db, t.owner, "confirm_swap", { p_trade_id: t.tradeId });
    await rpc(db, t.trader, "confirm_swap", { p_trade_id: t.tradeId });
    await expect(
      rpc(db, t.owner, "leave_review", { p_trade_id: t.tradeId, p_rating: 6 }),
    ).rejects.toThrow(/check constraint/);
    await expect(
      rpc(db, t.owner, "leave_review", { p_trade_id: t.tradeId, p_rating: 5, p_tags: ["best_ever"] }),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("friends", () => {
  it("lets you add and remove your own friends only", async () => {
    const me = await createUser(db);
    const maya = await createUser(db);
    const leo = await createUser(db);
    await asUser(db, me, (tx) => tx.query("insert into public.friends (user_id, friend_id) values ($1, $2)", [me, maya]));
    await expect(
      asUser(db, me, (tx) => tx.query("insert into public.friends (user_id, friend_id) values ($1, $2)", [leo, maya])),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, me, (tx) => tx.query("insert into public.friends (user_id, friend_id) values ($1, $2)", [me, me])),
    ).rejects.toThrow(/check constraint/);
  });
});
