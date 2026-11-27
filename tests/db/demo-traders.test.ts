/**
 * Prototype helpers (0009): demo traders who trade back instantly, the
 * welcome offer, example trades, experienced-trader history, live events
 * and the "next step" facts for the Home page.
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

type Steps = {
  has_pack: boolean;
  trader_level: string;
  answer_offer_id: string | null;
  answer_from: string | null;
  confirm_trade_id: string | null;
  review_trade_id: string | null;
  swaps_done: number;
  real_swaps: number;
  reviews_written: number;
  offers_made: number;
  joined_event: boolean;
  live_event_id: string | null;
  room_slug: string | null;
};

async function steps(user: string) {
  const { rows } = await asUser(db, user, (tx) => tx.query<Steps>("select * from public.my_next_steps()"));
  return rows[0];
}

async function member(name = "Tester") {
  const id = await createUser(db, { display_name: name });
  await db.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [community, id]);
  return id;
}

async function listing(userId: string, title: string, rarity: string, condition = "like_new") {
  return rpc<string>(db, userId, "create_listing", {
    p_community_id: community,
    p_title: title,
    p_description: "",
    p_condition: condition,
    p_rarity: rarity,
    p_size: "",
    p_looking_for: "",
    p_for_trade: true,
    p_image_paths: [`${userId}/${title.replace(/\W/g, "")}.jpg`],
  });
}

/** A demo trader's item set to exactly this rarity/condition. */
async function demoItem(rarity: string, condition = "sealed") {
  const { rows } = await db.query<{ id: string; owner_id: string }>(
    `select l.id, l.owner_id from public.listings l join public.profiles p on p.id = l.owner_id
     where p.is_demo and l.status = 'available' and l.for_trade
       and not exists (select 1 from public.offer_items oi where oi.listing_id = l.id)
     order by l.created_at limit 1`,
  );
  await db.query("update public.listings set rarity = $1, condition = $2 where id = $3", [rarity, condition, rows[0].id]);
  return rows[0];
}

async function messages(offerId: string) {
  const { rows } = await db.query<{ sender_id: string | null; kind: string; body: string }>(
    "select sender_id, kind, body from public.trade_messages where offer_id = $1 order by created_at",
    [offerId],
  );
  return rows;
}

describe("seeded prototype world", () => {
  it("has 10 experienced demo traders with items to trade", async () => {
    const { rows } = await db.query<{ n: number; experienced: number; with_items: number }>(
      `select count(*)::int as n,
              count(*) filter (where trader_level = 'experienced')::int as experienced,
              count(*) filter (where exists (
                select 1 from public.listings l where l.owner_id = p.id and l.for_trade and l.status = 'available'
              ))::int as with_items
       from public.profiles p where p.is_demo`,
    );
    expect(rows[0]).toEqual({ n: 10, experienced: 10, with_items: 10 });
  });

  it("has 12 example trades that already happened, with journeys and reviews", async () => {
    const user = await member();
    const { rows } = await asUser(db, user, (tx) =>
      tx.query<{ a_name: string; b_name: string; a_item_title: string; stars: string }>(
        "select * from public.recent_swaps(null, 30)",
      ),
    );
    expect(rows.length).toBe(12);
    expect(rows.every((r) => r.a_name && r.b_name && r.a_item_title && Number(r.stars) >= 4)).toBe(true);

    const journeys = await db.query<{ n: number }>("select count(*)::int as n from public.listing_transfers");
    expect(journeys.rows[0].n).toBeGreaterThanOrEqual(24);
  });

  it("has a live swap meet, a live contest and a mystery swap in Blind Boxes", async () => {
    const { rows } = await db.query<{ type: string; status: string; entries: number }>(
      `select e.type::text as type, e.status::text as status,
              (select count(*) from public.event_entries x where x.event_id = e.id)::int as entries
       from public.events e
       where e.community_id = $1 and e.title in ('Live Swap Meet', 'Live Showcase Contest', 'Mystery Swap')
       order by 1`,
      [community],
    );
    expect(rows.map((r) => `${r.type}:${r.status}`)).toEqual([
      "mystery_swap:upcoming",
      "showcase_contest:live",
      "swap_meet:live",
    ]);
    expect(rows.every((r) => r.entries >= 3)).toBe(true);
  });
});

describe("the welcome offer (solo-friendly first trade)", () => {
  it("arrives with the starter pack, and the whole swap works with one person", async () => {
    const me = await createUser(db, { display_name: "Solo" });
    await rpc(db, me, "claim_starter_pack", { p_community_id: community });

    let s = await steps(me);
    expect(s.has_pack).toBe(true);
    expect(s.answer_offer_id).toBeTruthy();
    expect(s.answer_from).toBeTruthy();
    expect(s.room_slug).toBe("blind-boxes");
    expect(s.live_event_id).toBeTruthy();

    const offerId = s.answer_offer_id!;
    const notes = await asUser(db, me, (tx) =>
      tx.query<{ type: string }>("select type::text as type from public.notifications"),
    );
    expect(notes.rows.map((n) => n.type)).toContain("new_offer");

    // Accept -> the demo trader confirms their side straight away.
    const tradeId = await rpc<string>(db, me, "accept_offer", { p_offer_id: offerId });
    const trade = await db.query<{ sender_confirmed_at: string | null; recipient_confirmed_at: string | null }>(
      "select sender_confirmed_at, recipient_confirmed_at from public.trades where id = $1",
      [tradeId],
    );
    expect(trade.rows[0].sender_confirmed_at).toBeTruthy(); // the demo trader sent the offer
    expect(trade.rows[0].recipient_confirmed_at).toBeNull();
    s = await steps(me);
    expect(s.confirm_trade_id).toBe(tradeId);

    // I confirm -> complete, and the demo trader reviews me.
    await rpc(db, me, "confirm_swap", { p_trade_id: tradeId });
    const reviews = await db.query<{ rating: number }>(
      "select rating from public.reviews where trade_id = $1 and reviewee_id = $2",
      [tradeId, me],
    );
    expect(reviews.rows).toEqual([{ rating: 5 }]);
    const chat = (await messages(offerId)).map((m) => m.body);
    expect(chat.indexOf("Swap complete! The items are now in each other's collections.")).toBeLessThan(
      chat.findIndex((b) => b.endsWith("left a review.")),
    );

    s = await steps(me);
    expect(s.swaps_done).toBe(1);
    expect(s.real_swaps).toBe(0); // that was a practice trader
    expect(s.review_trade_id).toBe(tradeId);
    expect(s.confirm_trade_id).toBeNull();

    // The demo trader put what it received back up for trade.
    const relisted = await db.query<{ for_trade: boolean }>(
      `select l.for_trade from public.listing_transfers t join public.listings l on l.id = t.listing_id
       where t.trade_id = $1 and t.from_user = $2`,
      [tradeId, me],
    );
    expect(relisted.rows.every((r) => r.for_trade)).toBe(true);
  });
});

describe("demo traders react instantly", () => {
  it("accept a balanced offer and confirm their side", async () => {
    const me = await member();
    const theirs = await demoItem("uncommon", "sealed"); // 2 points
    const mine = await listing(me, "Balanced offer item", "uncommon", "like_new"); // 1.8 points
    const offerId = await rpc<string>(db, me, "start_offer", { p_listing_id: theirs.id, p_listing_ids: [mine] });

    const offer = await db.query<{ status: string }>("select status from public.offers where id = $1", [offerId]);
    expect(offer.rows[0].status).toBe("accepted");
    const trade = await db.query<{ recipient_confirmed_at: string | null }>(
      "select recipient_confirmed_at from public.trades where offer_id = $1",
      [offerId],
    );
    expect(trade.rows[0].recipient_confirmed_at).toBeTruthy();
    expect((await messages(offerId)).some((m) => m.sender_id === theirs.owner_id && m.kind === "text")).toBe(true);
  });

  it("counter a lopsided offer by asking for more of your items", async () => {
    const me = await member();
    const theirs = await demoItem("rare", "sealed"); // 4 points
    const mine = await listing(me, "Lopsided A", "common", "like_new"); // 0.9 each
    for (const name of ["Lopsided B", "Lopsided C", "Lopsided D"]) await listing(me, name, "common", "like_new");

    const offerId = await rpc<string>(db, me, "start_offer", { p_listing_id: theirs.id, p_listing_ids: [mine] });
    const { rows } = await db.query<{ status: string; proposed_by: string; items: number }>(
      `select o.status::text as status, r.proposed_by,
              (select count(*) from public.offer_items oi where oi.round_id = r.id)::int as items
       from public.offers o join public.offer_rounds r on r.id = o.current_round_id where o.id = $1`,
      [offerId],
    );
    expect(rows[0]).toEqual({ status: "pending", proposed_by: theirs.owner_id, items: 5 });

    // Accepting their counter works and they've already confirmed.
    const tradeId = await rpc<string>(db, me, "accept_offer", { p_offer_id: offerId });
    const trade = await db.query<{ recipient_confirmed_at: string | null }>(
      "select recipient_confirmed_at from public.trades where id = $1",
      [tradeId],
    );
    expect(trade.rows[0].recipient_confirmed_at).toBeTruthy();
  });

  it("reply in trade chats and direct messages", async () => {
    const me = await member();
    const theirs = await demoItem("rare", "sealed");
    const mine = await listing(me, "Chatty item", "common", "well_loved");
    const offerId = await rpc<string>(db, me, "start_offer", { p_listing_id: theirs.id, p_listing_ids: [mine] });
    await asUser(db, me, (tx) =>
      tx.query("insert into public.trade_messages (offer_id, sender_id, body) values ($1, $2, 'Hi!')", [offerId, me]),
    );
    const chat = await messages(offerId);
    expect(chat[chat.length - 1].sender_id).toBe(theirs.owner_id);

    const thread = await rpc<string>(db, me, "start_direct_chat", { p_other: theirs.owner_id });
    await asUser(db, me, (tx) =>
      tx.query("insert into public.direct_messages (thread_id, sender_id, body) values ($1, $2, 'Hello')", [thread, me]),
    );
    const dms = await db.query<{ sender_id: string }>(
      "select sender_id from public.direct_messages where thread_id = $1 order by created_at",
      [thread],
    );
    expect(dms.rows.map((r) => r.sender_id)).toEqual([me, theirs.owner_id]);
  });
});

describe("experienced traders", () => {
  it("start with a trading history, quietly (no notifications)", async () => {
    const me = await member("Expert");
    await db.query("select public._give_trading_history($1, $2)", [me, community]);

    const { rows } = await db.query<{ trader_level: string; trades_completed: number; rating_count: number; bio: string }>(
      "select trader_level, trades_completed, rating_count, bio from public.profiles where id = $1",
      [me],
    );
    expect(rows[0].trader_level).toBe("experienced");
    expect(rows[0].trades_completed).toBeGreaterThanOrEqual(6);
    expect(rows[0].rating_count).toBeGreaterThanOrEqual(4);
    expect(rows[0].bio).toContain("Experienced");

    const trades = await db.query<{ n: number }>(
      "select count(*)::int as n from public.trades where status = 'completed' and recipient_id = $1",
      [me],
    );
    expect(trades.rows[0].n).toBe(2);
    const reviews = await db.query<{ n: number }>("select count(*)::int as n from public.reviews where reviewee_id = $1", [me]);
    expect(reviews.rows[0].n).toBe(2);
    const notes = await db.query<{ n: number }>("select count(*)::int as n from public.notifications where user_id = $1", [me]);
    expect(notes.rows[0].n).toBe(0);

    // Past swaps don't count as "done since opening your pack".
    expect((await steps(me)).swaps_done).toBe(0);
  });
});

describe("adding demo activity to another room", () => {
  it("adds demo traders and live events once", async () => {
    const me = await createUser(db);
    const { rows } = await db.query<{ id: string }>("select id from public.communities where slug = 'enamel-pins'");
    const pins = rows[0].id;

    await expect(rpc(db, me, "add_demo_activity", { p_community_id: pins })).rejects.toThrow(/Join the community/);
    await db.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [pins, me]);

    expect(await rpc<number>(db, me, "add_demo_activity", { p_community_id: pins })).toBe(3);
    expect(await rpc<number>(db, me, "add_demo_activity", { p_community_id: pins })).toBe(0);

    const live = await db.query<{ n: number }>(
      "select count(*)::int as n from public.events where community_id = $1 and status = 'live'",
      [pins],
    );
    expect(live.rows[0].n).toBe(2);
  });

  it("keeps the act-as-someone-else functions away from app users", async () => {
    const me = await createUser(db);
    for (const sql of [
      "select public._accept_offer_as(gen_random_uuid(), gen_random_uuid())",
      "select public._confirm_swap_as(gen_random_uuid(), gen_random_uuid())",
      "select public._give_trading_history(gen_random_uuid(), gen_random_uuid())",
      "select public.seed_demo_history()",
    ]) {
      await expect(asUser(db, me, (tx) => tx.query(sql))).rejects.toThrow(/permission denied/);
    }
  });
});
