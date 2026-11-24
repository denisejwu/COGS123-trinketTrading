# PopSwap

A web app where collectors trade trinkets (blind box figures, pins, keychains, trading cards and more) through collector communities.

**Flow:** 1. Listings → 2. Communities → 3. Trades, plus Community Events.

Built with Next.js 16 (App Router, TypeScript), Tailwind CSS 4 and Supabase (Postgres, Auth, Storage, Realtime).

---

## Build progress

| Phase | What | Status |
|---|---|---|
| 1 | Project setup, Supabase connection, auth, profiles | ✅ Done |
| 2 | Communities, listings with photos, comments | ⏳ Next |
| 3 | Offers with accept/decline rules | |
| 4 | Trade rooms, realtime chat, plan panel, complete trade | |
| 5 | Reviews, trader badge, events + RSVP, notifications | |
| 6 | Report/block, polish, deploy to Vercel | |

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
4. In Supabase go to **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:3000`
   - **Redirect URLs:** add `http://localhost:3000/**`

## 2. Run the database migrations

Every database change lives in `supabase/migrations/`, numbered in the order to run them.
Run each file **once**, in order, and run new ones as later phases add them.

**Option A: SQL Editor (easiest)**
1. Supabase dashboard → **SQL Editor** → **New query**.
2. Open the migration file (e.g. `supabase/migrations/0001_profiles.sql`), copy everything, paste it in, click **Run**.
3. You should see *Success. No rows returned*.

**Option B: Supabase CLI**
```bash
npx supabase login
npx supabase link --project-ref <your project ref>   # the xxxxxxxx in your project URL
npx supabase db push
```
Pick one option and stick with it. If you mix them, the CLI may try to re-run files you already ran in the SQL editor.

| File | Phase | What it adds |
|---|---|---|
| `0001_profiles.sql` | 1 | `profiles` table, sign-up trigger, `avatars` storage bucket, security rules |

## 3. Run the app

```bash
npm install      # first time only
npm run dev
```
Open http://localhost:3000.

### About confirmation emails

New accounts must confirm their email. Supabase's built-in email sender is only meant for testing:
it sends just a few emails per hour, and may only deliver to addresses on your Supabase team.
To make test accounts without waiting on email:

- Supabase → **Authentication → Users → Add user → Create new user**, tick **Auto Confirm User**.
  That account gets a username like `user_1a2b3c4d5e`; change it in **Settings** after logging in.
- For real users, set up a custom email provider (e.g. Resend) under **Authentication → Emails → SMTP Settings**.

Open email links **in the same browser** you signed up in, so the link can log you in automatically.
(If you open it somewhere else, your email still gets confirmed and you can just log in.)

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
| `npm run db:types` | Regenerate `src/lib/database.types.ts` from your linked Supabase project (after `supabase link`) |

---

## Project structure

```
src/
  app/
    (auth)/            login, signup, reset-password: pages without the nav bar
    (main)/            every logged-in page: home, profile, settings, ...
    auth/confirm/      where email links land (turns the link into a login)
    auth/signout/      log out (POST)
  components/          shared UI: Avatar, TraderBadge, nav, form fields, ...
  lib/
    supabase/          Supabase clients for the browser, server and proxy
    auth.ts            "who is logged in?" helpers
    database.types.ts  TypeScript types for the database
  proxy.ts             runs before each request: refreshes login, protects pages
supabase/
  migrations/          SQL files you run on Supabase, in order
tests/db/              database tests (PGlite)
```

**Folder names in parentheses** like `(main)` are *route groups*: they share a layout but don't appear in the URL.

**Security model:** every table has Row Level Security turned on. The browser only ever has the publishable key,
so it can only do what the policies allow. Multi-step actions (accepting an offer, completing a trade) run
inside Postgres functions so they happen all at once or not at all.

## Deploy

Deployment steps to Vercel are added in Phase 6.
