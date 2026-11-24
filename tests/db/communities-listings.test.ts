import { describe, it, expect, beforeAll } from "vitest";
import { createTestDb, createUser, asUser, rpc, type Db } from "./harness";

let db: Db;

beforeAll(async () => {
  db = await createTestDb({ seed: true });
});

/** Id of a seeded community, e.g. "blind-boxes". */
async function communityId(slug: string) {
  const { rows } = await db.query<{ id: string }>("select id from public.communities where slug = $1", [slug]);
  return rows[0].id;
}

/** Create a listing as `userId` with fake photo paths in their own folder. */
async function createListing(userId: string, overrides: Record<string, unknown> = {}) {
  return rpc<string>(db, userId, "create_listing", {
    p_community_id: await communityId("blind-boxes"),
    p_title: "Smiski Bed Series",
    p_description: "Opened to check, never displayed",
    p_condition: "like_new",
    p_rarity: "common",
    p_size: "5 cm",
    p_looking_for: "Any Sonny Angel",
    p_for_trade: true,
    p_image_paths: [`${userId}/a.jpg`, `${userId}/b.jpg`],
    ...overrides,
  });
}

describe("seed data", () => {
  it("creates the six starter communities", async () => {
    const { rows } = await db.query<{ slug: string }>("select slug from public.communities order by slug");
    expect(rows.map((r) => r.slug)).toEqual([
      "blind-boxes",
      "enamel-pins",
      "keychains",
      "plushies",
      "pokemon-cards",
      "trading-cards",
    ]);
  });
});

describe("communities", () => {
  it("creates a community with a clean slug and joins the creator", async () => {
    const me = await createUser(db);
    const slug = await rpc<string>(db, me, "create_community", {
      p_name: "Sanrio Swaps!",
      p_description: "Hello Kitty and friends",
    });
    expect(slug).toBe("sanrio-swaps");

    const { rows } = await db.query(
      `select 1 from public.community_members m join public.communities c on c.id = m.community_id
       where c.slug = $1 and m.user_id = $2`,
      [slug, me],
    );
    expect(rows).toHaveLength(1);
  });

  it("rejects a duplicate name, ignoring capital letters", async () => {
    const me = await createUser(db);
    await expect(
      rpc(db, me, "create_community", { p_name: "blind BOXES", p_description: "" }),
    ).rejects.toThrow(/already exists/);
  });

  it("lets you join and leave, but not add other people", async () => {
    const me = await createUser(db);
    const other = await createUser(db);
    const pins = await communityId("enamel-pins");

    await asUser(db, me, (tx) =>
      tx.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [pins, me]),
    );
    await expect(
      asUser(db, me, (tx) =>
        tx.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [pins, other]),
      ),
    ).rejects.toThrow(/row-level security/);

    await asUser(db, me, (tx) =>
      tx.query("delete from public.community_members where community_id = $1 and user_id = $2", [pins, me]),
    );
    const { rows } = await db.query("select 1 from public.community_members where community_id = $1 and user_id = $2", [pins, me]);
    expect(rows).toHaveLength(0);
  });
});

describe("listings", () => {
  it("saves a listing with its photos in order, and joins the community", async () => {
    const me = await createUser(db);
    const id = await createListing(me);

    const listing = await db.query<{ status: string; owner_id: string }>(
      "select status, owner_id from public.listings where id = $1",
      [id],
    );
    expect(listing.rows[0]).toEqual({ status: "available", owner_id: me });

    const photos = await db.query<{ path: string; position: number }>(
      "select path, position from public.listing_images where listing_id = $1 order by position",
      [id],
    );
    expect(photos.rows).toEqual([
      { path: `${me}/a.jpg`, position: 0 },
      { path: `${me}/b.jpg`, position: 1 },
    ]);

    const member = await db.query(
      "select 1 from public.community_members where community_id = $1 and user_id = $2",
      [await communityId("blind-boxes"), me],
    );
    expect(member.rows).toHaveLength(1);
  });

  it("requires between 1 and 4 photos", async () => {
    const me = await createUser(db);
    await expect(createListing(me, { p_image_paths: [] })).rejects.toThrow(/between 1 and 4 photos/);
    await expect(
      createListing(me, { p_image_paths: [1, 2, 3, 4, 5].map((n) => `${me}/${n}.jpg`) }),
    ).rejects.toThrow(/between 1 and 4 photos/);
  });

  it("won't use photos from someone else's folder", async () => {
    const me = await createUser(db);
    const other = await createUser(db);
    await expect(createListing(me, { p_image_paths: [`${other}/stolen.jpg`] })).rejects.toThrow(
      /row-level security/,
    );
  });

  it("doesn't let users change a listing's status by hand", async () => {
    const me = await createUser(db);
    const id = await createListing(me);
    await expect(
      asUser(db, me, (tx) => tx.query("update public.listings set status = 'traded' where id = $1", [id])),
    ).rejects.toThrow(/permission denied/);
  });

  it("only lets the owner edit or delete a listing", async () => {
    const owner = await createUser(db);
    const stranger = await createUser(db);
    const id = await createListing(owner);

    await expect(
      rpc(db, stranger, "update_listing", {
        p_listing_id: id,
        p_community_id: await communityId("blind-boxes"),
        p_title: "Hacked",
        p_description: "",
        p_condition: "sealed",
        p_rarity: "rare",
        p_size: null,
        p_looking_for: null,
        p_for_trade: true,
        p_image_paths: [`${stranger}/x.jpg`],
      }),
    ).rejects.toThrow(/only edit your own/);

    const deleted = await asUser(db, stranger, (tx) =>
      tx.query("delete from public.listings where id = $1", [id]),
    );
    expect(deleted.affectedRows).toBe(0);
  });

  it("returns removed photos when editing so they can be deleted from storage", async () => {
    const me = await createUser(db);
    const id = await createListing(me);
    const removed = await rpc<string[]>(db, me, "update_listing", {
      p_listing_id: id,
      p_community_id: await communityId("keychains"),
      p_title: "Smiski Bed Series (updated)",
      p_description: "",
      p_condition: "gently_used",
      p_rarity: "uncommon",
      p_size: null,
      p_looking_for: null,
      p_for_trade: false,
      p_image_paths: [`${me}/b.jpg`, `${me}/c.jpg`],
    });
    expect(removed).toEqual([`${me}/a.jpg`]);

    const { rows } = await db.query<{ for_trade: boolean; title: string }>(
      "select for_trade, title from public.listings where id = $1",
      [id],
    );
    expect(rows[0]).toEqual({ for_trade: false, title: "Smiski Bed Series (updated)" });
  });

  it("can't edit a listing that's in a trade", async () => {
    const me = await createUser(db);
    const id = await createListing(me);
    await db.query("update public.listings set status = 'pending' where id = $1", [id]); // as admin
    const updated = await asUser(db, me, (tx) =>
      tx.query("update public.listings set title = 'Changed title' where id = $1", [id]),
    );
    expect(updated.affectedRows).toBe(0);
  });
});

describe("comments and discussion", () => {
  it("lets anyone comment; the listing owner can remove comments", async () => {
    const owner = await createUser(db);
    const commenter = await createUser(db);
    const stranger = await createUser(db);
    const id = await createListing(owner);

    const { rows } = await asUser(db, commenter, (tx) =>
      tx.query<{ id: string }>(
        "insert into public.listing_comments (listing_id, author_id, body) values ($1, $2, 'Is it still available?') returning id",
        [id, commenter],
      ),
    );
    const commentId = rows[0].id;

    const strangerDelete = await asUser(db, stranger, (tx) =>
      tx.query("delete from public.listing_comments where id = $1", [commentId]),
    );
    expect(strangerDelete.affectedRows).toBe(0);

    const ownerDelete = await asUser(db, owner, (tx) =>
      tx.query("delete from public.listing_comments where id = $1", [commentId]),
    );
    expect(ownerDelete.affectedRows).toBe(1);
  });

  it("only lets members post, and replies only go one level deep", async () => {
    const member = await createUser(db);
    const outsider = await createUser(db);
    const plush = await communityId("plushies");
    await db.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [plush, member]);

    await expect(
      asUser(db, outsider, (tx) =>
        tx.query("insert into public.community_posts (community_id, author_id, body) values ($1, $2, 'hi')", [plush, outsider]),
      ),
    ).rejects.toThrow(/row-level security/);

    const post = await asUser(db, member, (tx) =>
      tx.query<{ id: string }>(
        "insert into public.community_posts (community_id, author_id, body) values ($1, $2, 'Anyone going to the swap meet?') returning id",
        [plush, member],
      ),
    );
    const reply = await asUser(db, member, (tx) =>
      tx.query<{ id: string }>(
        "insert into public.community_posts (community_id, author_id, parent_id, body) values ($1, $2, $3, 'Me!') returning id",
        [plush, member, post.rows[0].id],
      ),
    );
    await expect(
      asUser(db, member, (tx) =>
        tx.query(
          "insert into public.community_posts (community_id, author_id, parent_id, body) values ($1, $2, $3, 'nested')",
          [plush, member, reply.rows[0].id],
        ),
      ),
    ).rejects.toThrow(/top-level post/);
  });
});
