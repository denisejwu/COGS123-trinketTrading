-- =====================================================================
-- 0001_profiles.sql  (Phase 1)
-- User profiles, the sign-up trigger, and the avatars storage bucket.
-- Run this once in the Supabase SQL editor (or with `supabase db push`).
-- =====================================================================


-- ---------------------------------------------------------------------
-- Shared helper: keeps an `updated_at` column current on every UPDATE.
-- Later migrations reuse it for other tables.
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ---------------------------------------------------------------------
-- profiles: one row per user, linked 1-to-1 with Supabase's auth.users.
-- ---------------------------------------------------------------------
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  -- lowercase letters, numbers and underscores, 3-20 characters
  username      text not null unique check (username ~ '^[a-z0-9_]{3,20}$'),
  display_name  text not null check (char_length(display_name) between 1 and 50),
  -- path inside the `avatars` storage bucket, e.g. "<user id>/1700000000.jpg"
  avatar_path   text,
  bio           text check (char_length(bio) <= 280),
  -- school or city, used for the "nearby" filter
  location      text check (char_length(location) <= 80),

  -- Trader badge numbers. Users can't edit these directly (see the column
  -- permissions below); only the trade/review database functions change them.
  trades_completed int not null default 0,
  rating_count     int not null default 0,
  rating_avg       numeric(3, 2),          -- null until the first review

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- Sign-up trigger: when Supabase Auth creates a user, create their profile.
--
-- In the prototype people only type a name, which arrives as the
-- `display_name` metadata. We turn it into a username like "denise_4821"
-- (name + 4 random digits, retried until it's unique). If a `username` is
-- sent and free, we use that instead. We never let this fail, because an
-- error here would make the whole sign-up fail. Usernames can be changed
-- later in Settings.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer           -- runs with the owner's rights so it can insert
set search_path = ''       -- security best practice for security definer
as $$
declare
  wanted_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  final_display_name text := left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 50);
  base text;
  candidate text;
  final_username text;
begin
  if wanted_username ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = wanted_username) then
    final_username := wanted_username;
  else
    -- "Denise W." -> "denise_w" (letters and numbers only, max 15 characters)
    base := trim(both '_' from regexp_replace(lower(coalesce(final_display_name, '')), '[^a-z0-9]+', '_', 'g'));
    base := trim(both '_' from left(base, 15));
    if char_length(base) < 3 then
      base := 'trader';
    end if;

    -- Try a few random 4-digit endings until one is free.
    for attempt in 1 .. 20 loop
      candidate := base || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
      if not exists (select 1 from public.profiles p where p.username = candidate) then
        final_username := candidate;
        exit;
      end if;
    end loop;

    -- Practically never needed, but guaranteed unique.
    if final_username is null then
      final_username := 'user_' || left(replace(new.id::text, '-', ''), 10);
    end if;
  end if;

  final_display_name := coalesce(final_display_name, final_username);

  insert into public.profiles (id, username, display_name)
  values (new.id, final_username, final_display_name);

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- username_available(name): lets the sign-up form check a username
-- before the person has an account (so it must work for logged-out users).
-- It only answers true/false and never reveals anything else.
-- ---------------------------------------------------------------------
create or replace function public.username_available(name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (
    select 1 from public.profiles p where p.username = lower(name)
  );
$$;

grant execute on function public.username_available(text) to anon, authenticated;


-- ---------------------------------------------------------------------
-- Row Level Security for profiles
-- ---------------------------------------------------------------------
alter table public.profiles enable row level security;

create policy "Logged-in users can view profiles"
  on public.profiles for select
  to authenticated
  using (true);

create policy "Users can update their own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- No insert/delete policies: profiles are created by the trigger above and
-- deleted automatically when the auth user is deleted.

-- Column permissions: even on your own row you may only change these
-- columns, so nobody can give themselves a fake trade count or rating.
revoke update on public.profiles from anon, authenticated;
grant update (username, display_name, avatar_path, bio, location)
  on public.profiles to authenticated;


-- ---------------------------------------------------------------------
-- Storage: `avatars` bucket (public to view, max 5 MB, images only).
-- Each user uploads into a folder named after their user id:
--   avatars/<user id>/<file name>
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars', 'avatars', true, 5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "Anyone can view avatars"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Users can upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
