/**
 * Starter packs (0006): 4 random virtual trinkets, once per person,
 * plus filled-in profiles for new users.
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

describe("starter packs", () => {
  it("the catalog has 40 trinkets across 5 series", async () => {
    const { rows } = await db.query<{ n: number; series: number }>(
      "select count(*)::int as n, count(distinct series)::int as series from public.catalog_items",
    );
    expect(rows[0]).toEqual({ n: 40, series: 5 });
  });

  it("gives 4 tradeable virtual trinkets with photos, a goal, and joins the room", async () => {
    const me = await createUser(db);
    const ids = await rpc<string[]>(db, me, "claim_starter_pack", { p_community_id: community });
    expect(ids).toHaveLength(4);

    const { rows } = await db.query<{
      owner_id: string;
      for_trade: boolean;
      status: string;
      catalog_item_id: string | null;
      looking_for: string | null;
      path: string;
    }>(
      `select l.owner_id, l.for_trade, l.status, l.catalog_item_id, l.looking_for, li.path
       from public.listings l join public.listing_images li on li.listing_id = l.id
       where l.id = any($1)`,
      [ids],
    );
    expect(rows).toHaveLength(4);
    for (const row of rows) {
      expect(row).toMatchObject({ owner_id: me, for_trade: true, status: "available" });
      expect(row.catalog_item_id).toBeTruthy();
      expect(row.path).toMatch(/^\/catalog\/.+\.svg$/);
      expect(row.looking_for).toBeTruthy();
    }
    // Everyone's items share one collecting goal.
    expect(new Set(rows.map((r) => r.looking_for)).size).toBe(1);

    const member = await db.query("select 1 from public.community_members where community_id = $1 and user_id = $2", [community, me]);
    expect(member.rows).toHaveLength(1);
  });

  it("can only be opened once, and users can't reset it themselves", async () => {
    const me = await createUser(db);
    await rpc(db, me, "claim_starter_pack", { p_community_id: community });
    await expect(rpc(db, me, "claim_starter_pack", { p_community_id: community })).rejects.toThrow(/already opened/);
    await expect(
      asUser(db, me, (tx) => tx.query("update public.profiles set starter_pack_claimed_at = null where id = $1", [me])),
    ).rejects.toThrow(/permission denied/);
  });

  it("starter items can be traded like any listing", async () => {
    const a = await createUser(db);
    const b = await createUser(db);
    const [aItem] = await rpc<string[]>(db, a, "claim_starter_pack", { p_community_id: community });
    const [bItem] = await rpc<string[]>(db, b, "claim_starter_pack", { p_community_id: community });
    const offerId = await rpc<string>(db, b, "start_offer", { p_listing_id: aItem, p_listing_ids: [bItem] });
    const tradeId = await rpc<string>(db, a, "accept_offer", { p_offer_id: offerId });
    await rpc(db, a, "confirm_swap", { p_trade_id: tradeId });
    expect(await rpc<string>(db, b, "confirm_swap", { p_trade_id: tradeId })).toBe("completed");
    const { rows } = await db.query<{ owner_id: string }>("select owner_id from public.listings where id = $1", [aItem]);
    expect(rows[0].owner_id).toBe(b);
  });
});

describe("filled-in profiles", () => {
  it("new users get a default avatar, a starter bio and their school", async () => {
    const { rows: users } = await db.query<{ id: string }>(
      `insert into auth.users (raw_user_meta_data) values ('{"display_name": "Maya", "location": "UC San Diego"}') returning id`,
    );
    const { rows } = await db.query<{ avatar_path: string; bio: string; location: string; starter_pack_claimed_at: string | null }>(
      "select avatar_path, bio, location, starter_pack_claimed_at from public.profiles where id = $1",
      [users[0].id],
    );
    expect(rows[0].avatar_path).toMatch(/^\/avatars\/([1-9]|10)\.svg$/);
    expect(rows[0].bio).toBeTruthy();
    expect(rows[0].location).toBe("UC San Diego");
    expect(rows[0].starter_pack_claimed_at).toBeNull();
  });
});
