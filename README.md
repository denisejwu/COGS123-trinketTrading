# PopSwap

A web app where collectors trade trinkets (blind box figures, pins, keychains, trading cards and more) through collector communities.

**Flow:** 1. Listings → 2. Communities → 3. Trades, plus Community Events.

Built with Next.js 16 (App Router, TypeScript), Tailwind CSS 4 and Supabase (Postgres, Auth, Storage, Realtime).

### How trading works (prototype)

- **No money.** Trades are item-for-item swaps, and can include several items on each side.
- **Negotiation room.** An offer opens a private room with live chat. Either person can send a counter-offer
  (a new mix of items) until one of them accepts the other's latest proposal.
- **Fairness meter.** Every item gets points = rarity × condition (Common 1, Uncommon 2, Rare 4,
  Secret/Chase 8; Sealed ×1, Like new ×0.9, Gently used ×0.7, Well loved ×0.5). The meter compares both sides
  and suggests how to balance them. It's a guide; both people decide.
- **Rarity check.** Owners pick a rarity; other collectors can vote. After 3 votes the community's pick is used.
- **Virtual swaps.** Trading happens inside the app: when both people confirm, the items change owners
  (Phase 4). No meetups or shipping in this prototype.
- **Social extras.** "I want this" hearts, and trade matches found from the "Looking for" notes on listings.
- **Starter packs (virtual trinkets).** Everyone can open a one-time pack of 4 random virtual trinkets from
  5 made-up series (40 items, with original art in `public/catalog`). Odds: Common 60%, Uncommon 25%, Rare 12%,
  Secret 3%. Each pack also sets a collecting goal ("Looking for: Cosmic Cats"), so trade matches appear right
  away. "Post a listing" still works for real items. `npm run catalog` regenerates the art from `scripts/catalog-data.mjs`.
- **Chat everywhere.** A live **room chat** tab in every community, **direct messages** (Message button on
  profiles and listings), and a **Chats** page with unread counts. Trade chats stay inside each offer.
- **Filled-in profiles.** New people get a cute default avatar, a starter bio, and (if they typed it) their school.

---

## Build progress

| Phase | What | Status |
|---|---|---|
| 1 | Project setup, Supabase connection, auth, profiles | ✅ Done |
| 2 | Communities, listings with photos, comments | ✅ Done |
| 3 | Rarity + votes, wants, matches, negotiation room (offers, counter-offers, live chat, fairness meter) | ✅ Done |
| 4 | Virtual swap room: proof photos, both confirm, items change owners, item journey, reviews, friends | ✅ Done |
| 5 | Community events (swap meet, mystery swap, unboxing party, showcase contest, theme day), QR rooms | ✅ Done |
| 6 | Notifications, report/block, polish | ⏳ Next |

---

## 1. Set up Supabase (one time)

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
   - Name: `popswap`. Pick a region close to you (e.g. *West US*).
   - Set a database password and save it somewhere safe.
2. When the project is ready, open **Project Settings → API Keys** (or click **Connect** at the top).
   Copy the **Project URL** and the **Publishable key** (starts with `sb_publishable_`).
3. In this folder, copy `.env.example` to a new file named `.env.local` and paste the two values:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
   NEXT_PUBLIC_SITE_URL=http://localhost:3000
   ```
4. Turn on name-only accounts: **Authentication → Sign In / Providers → Allow anonymous sign-ins** → Save.
   (See "Accounts" below.)

## 2. Create the database (one paste)

All database changes live in `supabase/migrations/` (numbered in order) plus starter data in `supabase/seed.sql`.
For a **new, empty project**, run everything at once:

1. `npm run db:bundle` creates `supabase/setup-all.sql` (all migrations + seed in one file).
2. Open that file, select all (Ctrl+A) and copy (Ctrl+C).
3. Supabase → **SQL Editor** → **+ New query** → paste (Ctrl+V) → **Run**.
   If it warns about "destructive operations", click **Run this query**.
4. You should see *Success. No rows returned*. **Table Editor** now shows the tables.

The file runs as one transaction: if anything fails, nothing is saved, so you can fix it and run it again.

**Later phases** add new migration files. Either:
- `npm run db:bundle -- --from=0004` → paste `supabase/update.sql` (only the new files + seed) into the SQL Editor, or
- `npm run db:setup` with a temporary access token in `.env.setup`: it runs only the files your database doesn't have yet.

| File | Phase | What it adds |
|---|---|---|
| `0001_profiles.sql` | 1 | `profiles` table, sign-up trigger (name → username like `denise_4821`), `avatars` bucket, security rules |
| `0002_communities_listings.sql` | 2 | communities, members, listings + photos, comments, discussion posts, `listing-images` and `community-covers` buckets |
| `0003_negotiation.sql` | 3 | rarity, rarity votes, wants, offers / proposal rounds / items, chat messages (Realtime), trades, trade matches |
| `0004_swaps_reviews_friends.sql` | 4 | swap confirmations + ownership transfer, item journey, proof photos (private `trade-photos` bucket), reviews, friends |
| `0005_events.sql` | 5 | events, RSVPs, entries, votes, mystery swap shuffle, public room preview for QR joins |
| `0006_starter_packs.sql` | 6 | virtual trinket catalog, `claim_starter_pack`, default avatar/bio/school for new users |
| `0007_chat.sql` | 6 | room chat, direct message threads, unread counts (Realtime) |
| `seed.sql` | 2+ | starter communities, five starter events, and the 40-trinket catalog (safe to run again) |

**Check your setup any time** with `npm run check:supabase`. It uses only the publishable key and tells you
whether name-only sign-in is on and which tables and storage buckets it can find.

## 3. Run the app

```bash
npm install      # first time only
npm run dev
```
Open http://localhost:3000.

### Accounts (prototype)

There's no email or password. On the welcome page you type a name, and that creates your account
(Supabase "anonymous sign-in" plus a profile with a generated username you can change in Settings).

- You stay logged in while the browser is open: refreshes, new tabs and navigating are fine.
- The login is a **browser-session cookie**: closing the browser (or logging out) ends it, and that account
  can't be opened again. Your profile and listings stay visible to others.
- Each browser is its own person, so use a normal window and an Incognito window to test trading.
- Supabase limits new anonymous accounts to about 30 per hour per network by default.

## Running a live test with 50+ people (QR room)

1. **Raise the sign-up limit first.** Supabase → **Authentication → Rate Limits** → anonymous sign-ins: set it to
   about **300 per hour**. The default (~30/hour per network) blocks a classroom on one Wi-Fi.
2. Create a community for the session (e.g. "COGS123 Swap Day") on the **live site** (Vercel), not localhost,
   so phones can reach it.
3. Open the community → **Invite (QR)**. Put that screen on the projector. It shows a QR code, the link, and a
   live count + names as people join.
4. People scan, type a name, tap **Join the room**, and land inside the community.
5. Run events from the community's **Events** tab. As host you control them: **Start**, **End**, or for a
   mystery swap **Shuffle & reveal**.

Free-plan limits are fine for this size (Supabase Realtime allows 200 simultaneous connections).

## 4. Tests

```bash
npm test
```

The tests run the real migration files inside **PGlite** (a full Postgres that runs in memory, no Docker needed),
with a tiny imitation of Supabase's `auth` and `storage` schemas (`tests/db/supabase-shim.sql`).
They act as real logged-in users, so Row Level Security is tested too. They never touch your Supabase project.

## Other commands

| Command | What it does |
|---|---|
| `npm run build` | Production build (also type-checks) |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript check only |
| `npm run db:types:local` | Regenerate `src/lib/database.types.ts` from the migration files (no Supabase needed) |
| `npm run db:types` | Same, but from your linked Supabase project (after `supabase link`) |

---

## Project structure

```
src/
  app/
    (auth)/            welcome page (type a name to start): no nav bar
    (main)/            every logged-in page: home, profile, settings, ...
    auth/signout/      log out (POST)
  components/          shared UI: Avatar, TraderBadge, nav, form fields, ...
  lib/
    supabase/          Supabase clients for the browser, server and proxy
    auth.ts            "who is logged in?" helpers
    database.types.ts  TypeScript types for the database (generated)
    types.ts           friendly names for rows: Profile, Listing, ...
  proxy.ts             runs before each request: refreshes login, protects pages
supabase/
  migrations/          SQL files you run on Supabase, in order
  seed.sql             starter communities (and events, from Phase 5)
scripts/
  gen-db-types.mjs     builds database.types.ts from the migrations
tests/db/              database tests (PGlite)
```

**Folder names in parentheses** like `(main)` are *route groups*: they share a layout but don't appear in the URL.

**Security model:** every table has Row Level Security turned on. The browser only ever has the publishable key,
so it can only do what the policies allow. Multi-step actions (accepting an offer, completing a trade) run
inside Postgres functions so they happen all at once or not at all.

## Deploy

Deployment steps to Vercel are added in Phase 6.
