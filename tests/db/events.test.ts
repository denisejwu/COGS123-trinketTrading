/**
 * Phase 5 rules: community events (mystery swap, contest, unboxing...).
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

async function member() {
  const id = await createUser(db);
  await db.query("insert into public.community_members (community_id, user_id) values ($1, $2)", [community, id]);
  return id;
}

async function listing(userId: string, title: string, forTrade = true) {
  return rpc<string>(db, userId, "create_listing", {
    p_community_id: community,
    p_title: title,
    p_description: "",
    p_condition: "like_new",
    p_rarity: "common",
    p_size: "",
    p_looking_for: "",
    p_for_trade: forTrade,
    p_image_paths: [`${userId}/${title.replace(/\W/g, "")}.jpg`],
  });
}

async function newEvent(host: string, type: string, title: string) {
  const { rows } = await asUser(db, host, (tx) =>
    tx.query<{ id: string }>(
      `insert into public.events (community_id, created_by, type, title, starts_at)
       values ($1, $2, $3, $4, now()) returning id`,
      [community, host, type, title],
    ),
  );
  return rows[0].id;
}

describe("seeded events", () => {
  it("adds one starter event of each type", async () => {
    const { rows } = await db.query<{ type: string }>("select type::text as type from public.events order by 1");
    expect(rows.map((r) => r.type)).toEqual([
      "mystery_swap",
      "showcase_contest",
      "swap_meet",
      "theme_day",
      "unboxing_party",
    ]);
  });
});

describe("mystery swap", () => {
  it("gives every item to someone else, never back to its owner", async () => {
    const host = await member();
    const people = [await member(), await member(), await member(), await member()];
    const eventId = await newEvent(host, "mystery_swap", "Mystery test");

    const items: Record<string, string> = {};
    for (const [i, p] of people.entries()) {
      items[p] = await listing(p, `Mystery item ${i}`);
      await rpc(db, p, "add_event_entry", { p_event_id: eventId, p_listing_id: items[p] });
    }
    // Items in the pool are locked.
    const locked = await db.query<{ status: string }>("select status from public.listings where id = $1", [items[people[0]]]);
    expect(locked.rows[0].status).toBe("pending");

    const swapped = await rpc<number>(db, host, "run_mystery_swap", { p_event_id: eventId });
    expect(swapped).toBe(4);

    const receivers = new Set<string>();
    for (const p of people) {
      const { rows } = await db.query<{ owner_id: string; status: string }>(
        "select owner_id, status from public.listings where id = $1",
        [items[p]],
      );
      expect(rows[0].owner_id).not.toBe(p); // never your own item back
      expect(rows[0].status).toBe("available");
      receivers.add(rows[0].owner_id);
    }
    expect(receivers.size).toBe(4); // everyone received exactly one item

    const ev = await db.query<{ status: string }>("select status from public.events where id = $1", [eventId]);
    expect(ev.rows[0].status).toBe("ended");
  });

  it("only allows one item per person and only the host can reveal", async () => {
    const host = await member();
    const p = await member();
    const eventId = await newEvent(host, "mystery_swap", "Mystery rules");
    await rpc(db, p, "add_event_entry", { p_event_id: eventId, p_listing_id: await listing(p, "First") });
    await expect(
      rpc(db, p, "add_event_entry", { p_event_id: eventId, p_listing_id: await listing(p, "Second") }),
    ).rejects.toThrow(/one item/);
    await expect(rpc(db, p, "run_mystery_swap", { p_event_id: eventId })).rejects.toThrow(/Only the host/);
    await expect(rpc(db, host, "run_mystery_swap", { p_event_id: eventId })).rejects.toThrow(/at least 2 items/);
  });

  it("taking your item back out unlocks it", async () => {
    const host = await member();
    const p = await member();
    const eventId = await newEvent(host, "mystery_swap", "Mystery undo");
    const item = await listing(p, "Undo item");
    const entryId = await rpc<string>(db, p, "add_event_entry", { p_event_id: eventId, p_listing_id: item });
    await rpc(db, p, "remove_event_entry", { p_entry_id: entryId });
    const { rows } = await db.query<{ status: string }>("select status from public.listings where id = $1", [item]);
    expect(rows[0].status).toBe("available");
  });
});

describe("showcase contest", () => {
  it("gives everyone exactly one vote, and you can't vote for yourself", async () => {
    const host = await member();
    const a = await member();
    const b = await member();
    const voter = await member();
    const eventId = await newEvent(host, "showcase_contest", "Contest test");
    const entryA = await rpc<string>(db, a, "add_event_entry", { p_event_id: eventId, p_listing_id: await listing(a, "A best", false) });
    const entryB = await rpc<string>(db, b, "add_event_entry", { p_event_id: eventId, p_listing_id: await listing(b, "B best", false) });

    await expect(rpc(db, voter, "toggle_event_vote", { p_entry_id: entryA })).rejects.toThrow(/Voting opens/);
    await rpc(db, host, "set_event_status", { p_event_id: eventId, p_status: "live" });

    await rpc(db, voter, "toggle_event_vote", { p_entry_id: entryA });
    await rpc(db, voter, "toggle_event_vote", { p_entry_id: entryB }); // moves the vote
    const { rows } = await db.query<{ entry_id: string }>("select entry_id from public.event_votes where voter_id = $1", [voter]);
    expect(rows).toEqual([{ entry_id: entryB }]);

    await expect(rpc(db, a, "toggle_event_vote", { p_entry_id: entryA })).rejects.toThrow(/your own entry/);
  });
});

describe("other events", () => {
  it("unboxing posts need a photo from your own folder", async () => {
    const host = await member();
    const p = await member();
    const other = await member();
    const eventId = await newEvent(host, "unboxing_party", "Unboxing test");
    await expect(rpc(db, p, "add_event_entry", { p_event_id: eventId, p_caption: "no photo" })).rejects.toThrow(/Add a photo/);
    await expect(
      rpc(db, p, "add_event_entry", { p_event_id: eventId, p_photo_path: `${other}/x.jpg` }),
    ).rejects.toThrow(/isn't yours/);
    const id = await rpc<string>(db, p, "add_event_entry", { p_event_id: eventId, p_photo_path: `${p}/pull.jpg`, p_caption: "Got the secret!" });
    // Hearts toggle on and off.
    expect(await rpc<boolean>(db, other, "toggle_event_vote", { p_entry_id: id })).toBe(true);
    expect(await rpc<boolean>(db, other, "toggle_event_vote", { p_entry_id: id })).toBe(false);
  });

  it("non-members can't add entries, and people can't change event status directly", async () => {
    const host = await member();
    const outsider = await createUser(db);
    const eventId = await newEvent(host, "swap_meet", "Swap meet test");
    const item = await listing(outsider, "Outsider item");
    // listing() posts in the community, which joins it, so remove the membership again:
    await db.query("delete from public.community_members where community_id = $1 and user_id = $2", [community, outsider]);
    await expect(rpc(db, outsider, "add_event_entry", { p_event_id: eventId, p_listing_id: item })).rejects.toThrow(/Join the community/);
    await expect(
      asUser(db, host, (tx) => tx.query("update public.events set status = 'ended' where id = $1", [eventId])),
    ).rejects.toThrow(/permission denied/);
  });
});
