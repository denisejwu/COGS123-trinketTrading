-- =====================================================================
-- 0002_communities_listings.sql  (Phase 2)
-- Communities, memberships, listings with photos, listing comments and
-- community discussion posts. Run after 0001_profiles.sql.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Enums: the only values these columns can ever hold.
-- ---------------------------------------------------------------------
create type public.listing_condition as enum ('sealed', 'like_new', 'gently_used', 'well_loved');
create type public.listing_status as enum ('available', 'pending', 'traded');


-- =====================================================================
-- COMMUNITIES
-- =====================================================================
create table public.communities (
  id          uuid primary key default gen_random_uuid(),
  -- used in the URL: /c/blind-boxes
  slug        text not null unique
              check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 60),
  name        text not null check (char_length(name) between 3 and 50),
  description text not null default '' check (char_length(description) <= 500),
  -- path inside the `community-covers` bucket; null = use a default design
  cover_path  text,
  -- null for the communities that come with PopSwap (seed.sql)
  created_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- No two communities with the same name, ignoring capital letters.
create unique index communities_name_unique on public.communities (lower(name));

create trigger communities_set_updated_at
  before update on public.communities
  for each row execute function public.set_updated_at();


create table public.community_members (
  community_id uuid not null references public.communities (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (community_id, user_id)
);

-- "Which communities am I in?" (the primary key already covers lookups by community)
create index community_members_user_idx on public.community_members (user_id);


-- is_member(community): is the logged-in user in this community?
create or replace function public.is_member(p_community_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.community_members m
    where m.community_id = p_community_id and m.user_id = auth.uid()
  );
$$;


-- ---------------------------------------------------------------------
-- create_community: makes the community, picks a unique URL slug from
-- the name ("Pokémon Cards!" -> "pokemon-cards"), and joins the creator.
-- Returns the new slug.
-- ---------------------------------------------------------------------
create or replace function public.create_community(
  p_name text,
  p_description text,
  p_cover_path text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_name text := trim(p_name);
  v_base text;
  v_slug text;
  v_id uuid;
  v_n int := 1;
begin
  if v_user is null then
    raise exception 'You need to be logged in.' using errcode = '28000';
  end if;
  if char_length(v_name) not between 3 and 50 then
    raise exception 'Community names need 3 to 50 characters.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_description, '')) > 500 then
    raise exception 'Keep the description under 500 characters.' using errcode = '22023';
  end if;
  if exists (select 1 from public.communities c where lower(c.name) = lower(v_name)) then
    raise exception 'A community called "%" already exists.', v_name using errcode = '23505';
  end if;
  -- Cover images must come from your own upload folder.
  if p_cover_path is not null and p_cover_path not like v_user::text || '/%' then
    raise exception 'That cover image is not yours.' using errcode = '42501';
  end if;

  -- Build the slug: lowercase, strip accents, anything else becomes "-".
  v_base := translate(lower(v_name), 'áàâäãåéèêëíìîïóòôöõúùûüñç', 'aaaaaaeeeeiiiiooooouuuunc');
  v_base := trim(both '-' from regexp_replace(v_base, '[^a-z0-9]+', '-', 'g'));
  v_base := trim(both '-' from left(v_base, 50));
  if v_base = '' then
    v_base := 'community';
  end if;

  -- If the slug is taken, try name-2, name-3, ...
  v_slug := v_base;
  while exists (select 1 from public.communities c where c.slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;

  insert into public.communities (slug, name, description, cover_path, created_by)
  values (v_slug, v_name, coalesce(trim(p_description), ''), p_cover_path, v_user)
  returning id into v_id;

  insert into public.community_members (community_id, user_id) values (v_id, v_user);

  return v_slug;
end;
$$;

revoke execute on function public.create_community(text, text, text) from public, anon;
grant execute on function public.create_community(text, text, text) to authenticated;


-- =====================================================================
-- LISTINGS
-- =====================================================================
create table public.listings (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references public.profiles (id) on delete cascade,
  community_id uuid not null references public.communities (id) on delete restrict,
  title        text not null check (char_length(title) between 3 and 80),
  description  text not null default '' check (char_length(description) <= 1000),
  condition    public.listing_condition not null,
  size         text check (char_length(size) <= 60),
  -- free text, e.g. "Sprinkle Luka or any Miku"
  looking_for  text check (char_length(looking_for) <= 200),
  -- true = up for trade, false = showcase only
  for_trade    boolean not null default true,
  -- changed only by the offer/trade functions (Phases 3 and 4)
  status       public.listing_status not null default 'available',
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index listings_community_idx on public.listings (community_id, created_at desc);
create index listings_owner_idx on public.listings (owner_id, created_at desc);

create trigger listings_set_updated_at
  before update on public.listings
  for each row execute function public.set_updated_at();


create table public.listing_images (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  -- path inside the `listing-images` bucket: "<owner id>/<file>.jpg"
  path       text not null,
  -- 0 = cover photo, up to 3 (so at most 4 photos)
  position   smallint not null check (position between 0 and 3),
  created_at timestamptz not null default now(),
  unique (listing_id, position)
);


-- ---------------------------------------------------------------------
-- create_listing: saves a listing and its 1-4 photos together (if any
-- part fails, nothing is saved). Posting in a community also joins it.
-- Runs as the logged-in user, so all the security rules below apply.
-- ---------------------------------------------------------------------
create or replace function public.create_listing(
  p_community_id uuid,
  p_title text,
  p_description text,
  p_condition public.listing_condition,
  p_size text,
  p_looking_for text,
  p_for_trade boolean,
  p_image_paths text[]
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_id uuid;
  v_count int := coalesce(array_length(p_image_paths, 1), 0);
begin
  if v_user is null then
    raise exception 'You need to be logged in.' using errcode = '28000';
  end if;
  if v_count not between 1 and 4 then
    raise exception 'Add between 1 and 4 photos.' using errcode = '22023';
  end if;

  insert into public.listings
    (owner_id, community_id, title, description, condition, size, looking_for, for_trade)
  values (
    v_user, p_community_id, trim(p_title), coalesce(trim(p_description), ''), p_condition,
    nullif(trim(p_size), ''), nullif(trim(p_looking_for), ''), coalesce(p_for_trade, true)
  )
  returning id into v_id;

  for i in 1 .. v_count loop
    insert into public.listing_images (listing_id, path, position)
    values (v_id, p_image_paths[i], i - 1);
  end loop;

  insert into public.community_members (community_id, user_id)
  values (p_community_id, v_user)
  on conflict do nothing;

  return v_id;
end;
$$;


-- ---------------------------------------------------------------------
-- update_listing: edits a listing and replaces its photo list.
-- Returns the paths of photos that were removed, so the app can delete
-- those files from Storage.
-- ---------------------------------------------------------------------
create or replace function public.update_listing(
  p_listing_id uuid,
  p_community_id uuid,
  p_title text,
  p_description text,
  p_condition public.listing_condition,
  p_size text,
  p_looking_for text,
  p_for_trade boolean,
  p_image_paths text[]
)
returns text[]
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count int := coalesce(array_length(p_image_paths, 1), 0);
  v_removed text[];
begin
  if v_count not between 1 and 4 then
    raise exception 'Add between 1 and 4 photos.' using errcode = '22023';
  end if;

  -- The security rules only let this match your own *available* listing.
  update public.listings set
    community_id = p_community_id,
    title        = trim(p_title),
    description  = coalesce(trim(p_description), ''),
    condition    = p_condition,
    size         = nullif(trim(p_size), ''),
    looking_for  = nullif(trim(p_looking_for), ''),
    for_trade    = coalesce(p_for_trade, true)
  where id = p_listing_id;

  if not found then
    raise exception 'You can only edit your own listings while they are available.'
      using errcode = '42501';
  end if;

  select coalesce(array_agg(li.path), '{}') into v_removed
  from public.listing_images li
  where li.listing_id = p_listing_id and not (li.path = any (p_image_paths));

  delete from public.listing_images where listing_id = p_listing_id;
  for i in 1 .. v_count loop
    insert into public.listing_images (listing_id, path, position)
    values (p_listing_id, p_image_paths[i], i - 1);
  end loop;

  insert into public.community_members (community_id, user_id)
  values (p_community_id, v_user)
  on conflict do nothing;

  return v_removed;
end;
$$;

revoke execute on function public.create_listing(uuid, text, text, public.listing_condition, text, text, boolean, text[]) from public, anon;
revoke execute on function public.update_listing(uuid, uuid, text, text, public.listing_condition, text, text, boolean, text[]) from public, anon;
grant execute on function public.create_listing(uuid, text, text, public.listing_condition, text, text, boolean, text[]) to authenticated;
grant execute on function public.update_listing(uuid, uuid, text, text, public.listing_condition, text, text, boolean, text[]) to authenticated;


-- =====================================================================
-- COMMENTS ON LISTINGS (the "blue stickies" from the prototype)
-- =====================================================================
create table public.listing_comments (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index listing_comments_listing_idx on public.listing_comments (listing_id, created_at);


-- =====================================================================
-- COMMUNITY DISCUSSION
-- A post with parent_id = null starts a thread; replies point at it.
-- =====================================================================
create table public.community_posts (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  author_id    uuid not null references public.profiles (id) on delete cascade,
  parent_id    uuid references public.community_posts (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 2000),
  created_at   timestamptz not null default now()
);

create index community_posts_community_idx on public.community_posts (community_id, created_at desc);
create index community_posts_parent_idx on public.community_posts (parent_id, created_at);

-- Replies must be in the same community, and only one level deep.
create or replace function public.check_post_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent record;
begin
  if new.parent_id is not null then
    select p.community_id, p.parent_id into v_parent
    from public.community_posts p where p.id = new.parent_id;

    if not found or v_parent.community_id <> new.community_id then
      raise exception 'That post is not in this community.' using errcode = '22023';
    end if;
    if v_parent.parent_id is not null then
      raise exception 'You can only reply to a top-level post.' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create trigger community_posts_check_parent
  before insert on public.community_posts
  for each row execute function public.check_post_parent();


-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.communities       enable row level security;
alter table public.community_members enable row level security;
alter table public.listings          enable row level security;
alter table public.listing_images    enable row level security;
alter table public.listing_comments  enable row level security;
alter table public.community_posts   enable row level security;

-- communities: everyone logged in can browse. New ones are made through
-- create_community(), so there is no insert policy.
create policy "Logged-in users can view communities"
  on public.communities for select to authenticated using (true);

-- community_members: see who's in a community; join/leave only yourself.
create policy "Logged-in users can view members"
  on public.community_members for select to authenticated using (true);
create policy "Users can join communities"
  on public.community_members for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can leave communities"
  on public.community_members for delete to authenticated
  using (user_id = (select auth.uid()));

-- listings: anyone logged in can read; only the owner can change them,
-- and only while they're available (not in the middle of a trade).
create policy "Logged-in users can view listings"
  on public.listings for select to authenticated using (true);
create policy "Users can create their own listings"
  on public.listings for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy "Owners can edit available listings"
  on public.listings for update to authenticated
  using (owner_id = (select auth.uid()) and status = 'available')
  with check (owner_id = (select auth.uid()));
create policy "Owners can delete available listings"
  on public.listings for delete to authenticated
  using (owner_id = (select auth.uid()) and status = 'available');

-- Column permissions: nobody can set `status` or `owner_id` by hand.
revoke insert, update on public.listings from anon, authenticated;
grant insert (owner_id, community_id, title, description, condition, size, looking_for, for_trade)
  on public.listings to authenticated;
grant update (community_id, title, description, condition, size, looking_for, for_trade)
  on public.listings to authenticated;

-- listing_images: readable by all; managed by the listing's owner, and
-- photos must come from the owner's own upload folder.
create policy "Logged-in users can view listing photos"
  on public.listing_images for select to authenticated using (true);
create policy "Owners can add photos to their listings"
  on public.listing_images for insert to authenticated
  with check (
    path like (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid()) and l.status = 'available'
    )
  );
create policy "Owners can remove photos from their listings"
  on public.listing_images for delete to authenticated
  using (
    exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid()) and l.status = 'available'
    )
  );

-- listing_comments: anyone logged in can comment. You can delete your
-- own comments, and listing owners can delete comments on their listing.
create policy "Logged-in users can view comments"
  on public.listing_comments for select to authenticated using (true);
create policy "Users can comment as themselves"
  on public.listing_comments for insert to authenticated
  with check (author_id = (select auth.uid()));
create policy "Authors and listing owners can delete comments"
  on public.listing_comments for delete to authenticated
  using (
    author_id = (select auth.uid())
    or exists (
      select 1 from public.listings l
      where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  );

-- community_posts: readable by all; members can post and reply.
create policy "Logged-in users can view discussion posts"
  on public.community_posts for select to authenticated using (true);
create policy "Members can post in their communities"
  on public.community_posts for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_member(community_id));
create policy "Authors can delete their posts"
  on public.community_posts for delete to authenticated
  using (author_id = (select auth.uid()));


-- =====================================================================
-- STORAGE: listing photos and community cover images (public to view).
-- Uploads go into a folder named after your user id.
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('listing-images', 'listing-images', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  ('community-covers', 'community-covers', true, 5242880,
   array['image/jpeg', 'image/png', 'image/webp', 'image/gif'])
on conflict (id) do nothing;

create policy "Anyone can view listing images and covers"
  on storage.objects for select
  using (bucket_id in ('listing-images', 'community-covers'));

create policy "Users can upload listing images and covers to their folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id in ('listing-images', 'community-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete their own listing images and covers"
  on storage.objects for delete to authenticated
  using (
    bucket_id in ('listing-images', 'community-covers')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
