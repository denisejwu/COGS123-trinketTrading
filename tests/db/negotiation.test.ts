/**
 * Trade rules for Phase 3: offers, counter-offers, accepting and declining.
 * Every action runs as a real logged-in user, so security rules apply.
 */
import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, createUser, asUser, rpc, type Db } from "./harness";

let db: Db;
let community: string;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
  const { rows } = await db.query<{ id: string }>(
    "select id from public.communities where slug = 'blind-boxes'",
  );
  community = rows[0].id;
});

/** Post a listing as `userId` and return its id. */
async function listing(
  userId: string,
  title: string,
  extra: { forTrade?: boolean; lookingFor?: string; rarity?: string } = {},
) {
  return rpc<string>(db, userId, "create_listing", {
    p_community_id: community,
    p_title: title,
    p_description: "",
    p_condition: "like_new",
    p_rarity: extra.rarity ?? "common",
    p_size: "",
    p_looking_for: extra.lookingFor ?? "",
    p_for_trade: extra.forTrade ?? true,
    p_image_paths: [`${userId}/${title.replace(/\W/g, "")}.jpg`],
  });
}

async function statusOf(listingId: string) {
  const { rows } = await db.query<{ status: string }>("select status from public.listings where id = $1", [listingId]);
  return rows[0].status;
}

async function offerStatus(offerId: string) {
  const { rows } = await db.query<{ status: string }>("select status from public.offers where id = $1", [offerId]);
  return rows[0].status;
}

describe("making an offer", () => {
  it("can't offer on your own listing", async () => {
    const me = await createUser(db);
    const mine = await listing(me, "My Smiski");
    const alsoMine = await listing(me, "My other Smiski");
    await expect(
      rpc(db, me, "start_offer", { p_listing_id: mine, p_listing_ids: [alsoMine] }),
    ).rejects.toThrow(/own listing/);
  });

  it("can't offer on a showcase-only listing", async () => {
    const owner = await createUser(db);
    const buyer = await createUser(db);
    const showcase = await listing(owner, "Not for trade", { forTrade: false });
    const mine = await listing(buyer, "My figure");
    await expect(
      rpc(db, buyer, "start_offer", { p_listing_id: showcase, p_listing_ids: [mine] }),
    ).rejects.toThrow(/isn't available for trade/);
  });

  it("can only offer your own available, tradeable items", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const stranger = await createUser(db);
    const theirs = await listing(owner, "Their figure");
    const strangers = await listing(stranger, "Stranger figure");
    const myShowcase = await listing(me, "My showcase", { forTrade: false });

    await expect(
      rpc(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [strangers] }),
    ).rejects.toThrow(/can't be included/);
    await expect(
      rpc(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [myShowcase] }),
    ).rejects.toThrow(/can't be included/);
    // Nothing offered from my side at all:
    await expect(rpc(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [] })).rejects.toThrow(
      /at least one item from each/,
    );
  });

  it("creates the negotiation, first proposal and chat message", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const theirs = await listing(owner, "Sprinkle Luka");
    const theirExtra = await listing(owner, "Keychain");
    const mine = await listing(me, "Miku");

    const offerId = await rpc<string>(db, me, "start_offer", {
      p_listing_id: theirs,
      p_listing_ids: [mine, theirExtra],
      p_message: "Would you swap both for my Miku?",
    });

    const items = await asUser(db, owner, (tx) =>
      tx.query<{ listing_id: string; giver_id: string }>(
        `select oi.listing_id, oi.giver_id from public.offer_items oi
         join public.offers o on o.current_round_id = oi.round_id where o.id = $1`,
        [offerId],
      ),
    );
    expect(items.rows).toHaveLength(3);
    expect(items.rows.filter((i) => i.giver_id === owner)).toHaveLength(2);

    const messages = await asUser(db, owner, (tx) =>
      tx.query<{ kind: string; body: string }>("select kind, body from public.trade_messages where offer_id = $1", [offerId]),
    );
    expect(messages.rows).toEqual([{ kind: "proposal", body: "Would you swap both for my Miku?" }]);
  });

  it("won't open a second negotiation for the same item", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const theirs = await listing(owner, "Dup target");
    const mine = await listing(me, "Dup mine");
    await rpc(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [mine] });
    await expect(rpc(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [mine] })).rejects.toThrow(
      /already have an open negotiation/,
    );
  });
});

describe("privacy", () => {
  it("keeps negotiations and chats private to the two people", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const outsider = await createUser(db);
    const offerId = await rpc<string>(db, me, "start_offer", {
      p_listing_id: await listing(owner, "Private A"),
      p_listing_ids: [await listing(me, "Private B")],
    });

    const seen = await asUser(db, outsider, (tx) => tx.query("select id from public.offers where id = $1", [offerId]));
    expect(seen.rows).toHaveLength(0);
    const chat = await asUser(db, outsider, (tx) =>
      tx.query("select id from public.trade_messages where offer_id = $1", [offerId]),
    );
    expect(chat.rows).toHaveLength(0);

    await expect(
      asUser(db, outsider, (tx) =>
        tx.query("insert into public.trade_messages (offer_id, sender_id, body) values ($1, $2, 'hi')", [offerId, outsider]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("lets participants chat, but not fake system messages", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const offerId = await rpc<string>(db, me, "start_offer", {
      p_listing_id: await listing(owner, "Chat A"),
      p_listing_ids: [await listing(me, "Chat B")],
    });

    await asUser(db, owner, (tx) =>
      tx.query("insert into public.trade_messages (offer_id, sender_id, body) values ($1, $2, 'Hi! Is it sealed?')", [offerId, owner]),
    );
    await expect(
      asUser(db, owner, (tx) =>
        tx.query(
          "insert into public.trade_messages (offer_id, sender_id, kind, body) values ($1, $2, 'system', 'Offer accepted!')",
          [offerId, owner],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("counter-offers and accepting", () => {
  it("lets either person counter, and only the other person can accept", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const theirs = await listing(owner, "Secret figure", { rarity: "secret" });
    const mine = await listing(me, "Common figure");
    const mine2 = await listing(me, "Another common");
    const offerId = await rpc<string>(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [mine] });

    // I can't accept my own proposal.
    await expect(rpc(db, me, "accept_offer", { p_offer_id: offerId })).rejects.toThrow(/You sent the latest proposal/);

    // The owner counters: asks for both of my items.
    await rpc(db, owner, "counter_offer", {
      p_offer_id: offerId,
      p_listing_ids: [theirs, mine, mine2],
      p_message: "It's a secret, so I'd need both.",
    });
    // Now the owner can't accept their own counter, but I can.
    await expect(rpc(db, owner, "accept_offer", { p_offer_id: offerId })).rejects.toThrow(/You sent the latest proposal/);
    const tradeId = await rpc<string>(db, me, "accept_offer", { p_offer_id: offerId });
    expect(tradeId).toBeTruthy();

    expect(await offerStatus(offerId)).toBe("accepted");
    for (const id of [theirs, mine, mine2]) expect(await statusOf(id)).toBe("pending");
  });

  it("outsiders can't counter or accept", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const outsider = await createUser(db);
    const theirs = await listing(owner, "Outsider target");
    const offerId = await rpc<string>(db, me, "start_offer", {
      p_listing_id: theirs,
      p_listing_ids: [await listing(me, "Outsider mine")],
    });
    await expect(rpc(db, outsider, "accept_offer", { p_offer_id: offerId })).rejects.toThrow(/not found/);
    await expect(
      rpc(db, outsider, "counter_offer", { p_offer_id: offerId, p_listing_ids: [theirs] }),
    ).rejects.toThrow(/not found/);
  });

  it("accepting automatically declines every other open offer involving those items", async () => {
    const owner = await createUser(db);
    const alice = await createUser(db);
    const bob = await createUser(db);
    const carol = await createUser(db);

    const prize = await listing(owner, "Popular prize");
    const other = await listing(owner, "Unrelated item");
    const aliceItem = await listing(alice, "Alice item");
    const bobItem = await listing(bob, "Bob item");
    const carolItem = await listing(carol, "Carol item");

    const aliceOffer = await rpc<string>(db, alice, "start_offer", { p_listing_id: prize, p_listing_ids: [aliceItem] });
    const bobOffer = await rpc<string>(db, bob, "start_offer", { p_listing_id: prize, p_listing_ids: [bobItem] });
    // Carol's offer is for a different item of the owner's: it must stay open.
    const carolOffer = await rpc<string>(db, carol, "start_offer", { p_listing_id: other, p_listing_ids: [carolItem] });

    await rpc(db, owner, "accept_offer", { p_offer_id: aliceOffer });

    expect(await offerStatus(aliceOffer)).toBe("accepted");
    expect(await offerStatus(bobOffer)).toBe("declined");
    expect(await offerStatus(carolOffer)).toBe("pending");

    // Bob gets a note in his chat explaining why.
    const note = await asUser(db, bob, (tx) =>
      tx.query<{ body: string }>("select body from public.trade_messages where offer_id = $1 and kind = 'system'", [bobOffer]),
    );
    expect(note.rows[0].body).toMatch(/now part of another trade/);
  });

  it("also closes offers where the item was only on the offering side", async () => {
    const owner1 = await createUser(db);
    const owner2 = await createUser(db);
    const me = await createUser(db);
    const myItem = await listing(me, "My double-offered item");
    const offer1 = await rpc<string>(db, me, "start_offer", {
      p_listing_id: await listing(owner1, "Target one"),
      p_listing_ids: [myItem],
    });
    const offer2 = await rpc<string>(db, me, "start_offer", {
      p_listing_id: await listing(owner2, "Target two"),
      p_listing_ids: [myItem],
    });
    await rpc(db, owner1, "accept_offer", { p_offer_id: offer1 });
    expect(await offerStatus(offer2)).toBe("declined");
  });

  it("declining or cancelling leaves every listing available", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const theirs = await listing(owner, "Decline target");
    const mine = await listing(me, "Decline mine");

    const first = await rpc<string>(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [mine] });
    await expect(rpc(db, me, "decline_offer", { p_offer_id: first })).rejects.toThrow(/Only the person who received/);
    await rpc(db, owner, "decline_offer", { p_offer_id: first });
    expect(await offerStatus(first)).toBe("declined");

    const second = await rpc<string>(db, me, "start_offer", { p_listing_id: theirs, p_listing_ids: [mine] });
    await rpc(db, me, "cancel_offer", { p_offer_id: second });
    expect(await offerStatus(second)).toBe("cancelled");

    expect(await statusOf(theirs)).toBe("available");
    expect(await statusOf(mine)).toBe("available");
  });

  it("closes open offers when an item is switched to showcase only", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const theirs = await listing(owner, "Soon showcase");
    const offerId = await rpc<string>(db, me, "start_offer", {
      p_listing_id: theirs,
      p_listing_ids: [await listing(me, "Showcase mine")],
    });
    await asUser(db, owner, (tx) => tx.query("update public.listings set for_trade = false where id = $1", [theirs]));
    expect(await offerStatus(offerId)).toBe("declined");
  });

  it("a listing that's locked in a trade can't be offered again", async () => {
    const owner = await createUser(db);
    const me = await createUser(db);
    const late = await createUser(db);
    const theirs = await listing(owner, "Locked item");
    const offerId = await rpc<string>(db, me, "start_offer", {
      p_listing_id: theirs,
      p_listing_ids: [await listing(me, "Locker")],
    });
    await rpc(db, owner, "accept_offer", { p_offer_id: offerId });
    await expect(
      rpc(db, late, "start_offer", { p_listing_id: theirs, p_listing_ids: [await listing(late, "Too late")] }),
    ).rejects.toThrow(/isn't available/);
  });
});

describe("wants, rarity votes and matches", () => {
  it("lets you heart and vote on others' listings, but not your own", async () => {
    const owner = await createUser(db);
    const fan = await createUser(db);
    const item = await listing(owner, "Hearted item");

    await asUser(db, fan, (tx) =>
      tx.query("insert into public.listing_wants (listing_id, user_id) values ($1, $2)", [item, fan]),
    );
    await asUser(db, fan, (tx) =>
      tx.query("insert into public.listing_rarity_votes (listing_id, voter_id, rarity) values ($1, $2, 'rare')", [item, fan]),
    );
    await expect(
      asUser(db, owner, (tx) =>
        tx.query("insert into public.listing_wants (listing_id, user_id) values ($1, $2)", [item, owner]),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      asUser(db, owner, (tx) =>
        tx.query("insert into public.listing_rarity_votes (listing_id, voter_id, rarity) values ($1, $2, 'secret')", [item, owner]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("finds trade matches from the 'Looking for' text", async () => {
    const me = await createUser(db);
    const maya = await createUser(db);
    // Made-up words, so listings from other tests in this database can't match.
    const mine = await listing(me, "Zorblax Bed Series", { lookingFor: "Quixel Luka or any Wumpus" });
    const hers = await listing(maya, "Wumpus Quixel Edition", { lookingFor: "zorblax" });
    await listing(maya, "Totally unrelated plush");

    const matches = await asUser(db, me, (tx) =>
      tx.query<{ my_listing_id: string; their_listing_id: string; match_kind: string }>(
        "select * from public.get_trade_matches()",
      ),
    );
    expect(matches.rows).toEqual([{ my_listing_id: mine, their_listing_id: hers, match_kind: "perfect" }]);
  });
});
