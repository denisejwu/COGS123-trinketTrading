-- =====================================================================
-- 0006_starter_packs.sql
-- Virtual trinkets for the prototype: a catalog of made-up collectibles,
-- a one-time random "starter pack" per person, and a filled-in profile
-- (cute default avatar, starter bio, optional school) for new users.
-- Run after 0005_events.sql. The catalog rows are in seed.sql.
-- =====================================================================

-- The catalog: every virtual trinket that can come out of a pack.
create table public.catalog_items (
  id         uuid primary key default gen_random_uuid(),
  slug       text not null unique,
  name       text not null,
  series     text not null,
  form       text not null,          -- Figure, Keychain, Pin, Plush, Trading card
  rarity     public.listing_rarity not null check (rarity <> 'unsure'),
  blurb      text not null default '',
  -- a picture that ships with the app, e.g. "/catalog/cosmic-cats-rocket-cat.svg"
  image_path text not null
);

alter table public.catalog_items enable row level security;
create policy "Logged-in users can view the catalog"
  on public.catalog_items for select to authenticated using (true);

-- Listings made from the catalog remember which trinket they are.
alter table public.listings
  add column catalog_item_id uuid references public.catalog_items (id) on delete set null;

-- When someone opened their starter pack (users can't change this themselves).
alter table public.profiles
  add column starter_pack_claimed_at timestamptz;


-- ---------------------------------------------------------------------
-- claim_starter_pack: once per person, 4 random trinkets go into the
-- given community (the room you're in), up for trade. Rarity odds:
-- Common 60%, Uncommon 25%, Rare 12%, Secret 3%. Every item gets a
-- "Looking for" goal (a random series), which lights up trade matches.
-- ---------------------------------------------------------------------
create or replace function public.claim_starter_pack(p_community_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_goal text;
  v_roll float;
  v_rarity public.listing_rarity;
  v_condition public.listing_condition;
  v_item public.catalog_items;
  v_listing_id uuid;
  v_ids uuid[] := '{}';
begin
  if v_user is null then
    raise exception 'You need to be logged in.' using errcode = '28000';
  end if;
  if (select starter_pack_claimed_at from public.profiles where id = v_user) is not null then
    raise exception 'You already opened your starter pack.' using errcode = '23505';
  end if;
  if not exists (select 1 from public.communities c where c.id = p_community_id) then
    raise exception 'Community not found.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.catalog_items) then
    raise exception 'Starter packs aren''t set up yet (run seed.sql).' using errcode = 'P0002';
  end if;

  insert into public.community_members (community_id, user_id)
  values (p_community_id, v_user)
  on conflict do nothing;

  -- One collecting goal for this person.
  select ci.series into v_goal from public.catalog_items ci order by random() limit 1;

  for i in 1 .. 4 loop
    v_roll := random() * 100;
    v_rarity := case when v_roll < 3 then 'secret' when v_roll < 15 then 'rare'
                     when v_roll < 40 then 'uncommon' else 'common' end;
    v_roll := random() * 100;
    v_condition := case when v_roll < 50 then 'sealed' when v_roll < 80 then 'like_new' else 'gently_used' end;

    select * into v_item from public.catalog_items ci where ci.rarity = v_rarity order by random() limit 1;

    insert into public.listings
      (owner_id, community_id, title, description, condition, rarity, for_trade, looking_for, catalog_item_id)
    values (
      v_user, p_community_id,
      v_item.name || ' · ' || v_item.series,
      v_item.blurb || ' (' || v_item.form || ', virtual trinket from a starter pack.)',
      v_condition, v_item.rarity, true, v_goal, v_item.id
    )
    returning id into v_listing_id;

    insert into public.listing_images (listing_id, path, position) values (v_listing_id, v_item.image_path, 0);
    v_ids := v_ids || v_listing_id;
  end loop;

  update public.profiles set starter_pack_claimed_at = now() where id = v_user;
  return v_ids;
end;
$$;

revoke execute on function public.claim_starter_pack(uuid) from public, anon;
grant execute on function public.claim_starter_pack(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- New users get a filled-in profile: a cute default avatar (one of the
-- pictures in /public/avatars), a starter bio, and their school/city if
-- they typed one when joining. Everything can be changed in Settings.
-- ---------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  wanted_username text := lower(coalesce(new.raw_user_meta_data ->> 'username', ''));
  final_display_name text := left(nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''), 50);
  final_location text := left(nullif(trim(new.raw_user_meta_data ->> 'location'), ''), 80);
  base text;
  candidate text;
  final_username text;
begin
  if wanted_username ~ '^[a-z0-9_]{3,20}$'
     and not exists (select 1 from public.profiles p where p.username = wanted_username) then
    final_username := wanted_username;
  else
    base := trim(both '_' from regexp_replace(lower(coalesce(final_display_name, '')), '[^a-z0-9]+', '_', 'g'));
    base := trim(both '_' from left(base, 15));
    if char_length(base) < 3 then
      base := 'trader';
    end if;
    for attempt in 1 .. 20 loop
      candidate := base || '_' || lpad(floor(random() * 10000)::int::text, 4, '0');
      if not exists (select 1 from public.profiles p where p.username = candidate) then
        final_username := candidate;
        exit;
      end if;
    end loop;
    if final_username is null then
      final_username := 'user_' || left(replace(new.id::text, '-', ''), 10);
    end if;
  end if;

  final_display_name := coalesce(final_display_name, final_username);

  insert into public.profiles (id, username, display_name, avatar_path, bio, location)
  values (
    new.id,
    final_username,
    final_display_name,
    '/avatars/' || (1 + floor(random() * 10))::int || '.svg',
    'New to PopSwap and ready to trade!',
    final_location
  );

  return new;
end;
$$;
