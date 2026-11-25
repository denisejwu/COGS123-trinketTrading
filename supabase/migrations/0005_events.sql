-- =====================================================================
-- 0005_events.sql  (Phase 5)
-- Community events you can actually play inside the app:
--   swap_meet        bring items to a shared table, trade live
--   mystery_swap     everyone puts one item in a pool; shuffle & reveal
--   unboxing_party   post photos of your pulls, others heart them
--   showcase_contest enter your best item, one vote each, a winner
--   theme_day        a themed shelf (e.g. "Sanrio Saturday")
-- Run after 0004_swaps_reviews_friends.sql.
-- =====================================================================

create type public.event_type as enum
  ('swap_meet', 'mystery_swap', 'unboxing_party', 'showcase_contest', 'theme_day');
create type public.event_status as enum ('upcoming', 'live', 'ended');

create table public.events (
  id            uuid primary key default gen_random_uuid(),
  community_id  uuid not null references public.communities (id) on delete cascade,
  -- null for the starter events in seed.sql (any member can host those)
  created_by    uuid references public.profiles (id) on delete set null,
  type          public.event_type not null,
  title         text not null check (char_length(title) between 3 and 80),
  description   text not null default '' check (char_length(description) <= 1000),
  theme         text check (char_length(theme) <= 80),
  starts_at     timestamptz not null,
  place         text not null default 'In the PopSwap room' check (char_length(place) <= 120),
  mini_activity text check (char_length(mini_activity) <= 300),
  status        public.event_status not null default 'upcoming',
  revealed_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index events_community_idx on public.events (community_id, starts_at);

create trigger events_set_updated_at
  before update on public.events
  for each row execute function public.set_updated_at();

alter table public.listing_transfers
  add constraint listing_transfers_event_id_fkey
  foreign key (event_id) references public.events (id) on delete set null;

-- Who's going.
create table public.event_rsvps (
  event_id   uuid not null references public.events (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- What people bring / post / enter. Either a listing, a photo, or both.
create table public.event_entries (
  id          uuid primary key default gen_random_uuid(),
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  listing_id  uuid references public.listings (id) on delete cascade,
  -- unboxing photos live in the listing-images bucket: "<user id>/<file>"
  photo_path  text,
  caption     text check (char_length(caption) <= 300),
  -- mystery swap: who received this item at the reveal
  receiver_id uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  check (listing_id is not null or photo_path is not null)
);

create index event_entries_event_idx on public.event_entries (event_id, created_at);

-- Hearts (unboxing, swap meet, theme day) and contest votes.
create table public.event_votes (
  entry_id   uuid not null references public.event_entries (id) on delete cascade,
  event_id   uuid not null references public.events (id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (entry_id, voter_id)
);

create index event_votes_event_idx on public.event_votes (event_id);


-- =====================================================================
-- HELPERS
-- =====================================================================

-- Can the logged-in user run this event (start / end / reveal)?
-- The person who created it, or any member for the starter events.
create or replace function public.can_host_event(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.events e
    where e.id = p_event_id
      and (
        e.created_by = auth.uid()
        or (e.created_by is null and public.is_member(e.community_id))
      )
  );
$$;


-- =====================================================================
-- EVENT ACTIONS
-- =====================================================================

-- set_event_status: the host starts or ends the event.
create or replace function public.set_event_status(p_event_id uuid, p_status public.event_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or not public.can_host_event(p_event_id) then
    raise exception 'Only the host can do that.' using errcode = '42501';
  end if;
  if v_event.status = 'ended' then
    raise exception 'This event has already ended.' using errcode = '22023';
  end if;
  if v_event.type = 'mystery_swap' and p_status = 'ended' then
    raise exception 'Use “Shuffle & reveal” to finish a mystery swap.' using errcode = '22023';
  end if;
  update public.events set status = p_status where id = p_event_id;
end;
$$;

-- add_event_entry: bring an item / post a photo / enter the contest.
create or replace function public.add_event_entry(
  p_event_id uuid,
  p_listing_id uuid default null,
  p_photo_path text default null,
  p_caption text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_event public.events;
  v_listing public.listings;
  v_count int;
  v_id uuid;
begin
  select * into v_event from public.events where id = p_event_id;
  if not found or v_user is null then
    raise exception 'Event not found.' using errcode = 'P0002';
  end if;
  if not public.is_member(v_event.community_id) then
    raise exception 'Join the community first.' using errcode = '42501';
  end if;
  if v_event.status = 'ended' then
    raise exception 'This event has ended.' using errcode = '22023';
  end if;
  if char_length(coalesce(p_caption, '')) > 300 then
    raise exception 'Keep the caption under 300 characters.' using errcode = '22023';
  end if;

  if p_listing_id is not null then
    select * into v_listing from public.listings where id = p_listing_id;
    if not found or v_listing.owner_id <> v_user then
      raise exception 'You can only add your own items.' using errcode = '42501';
    end if;
    if exists (select 1 from public.event_entries x where x.event_id = p_event_id and x.listing_id = p_listing_id) then
      raise exception 'That item is already in this event.' using errcode = '23505';
    end if;
  end if;
  if p_photo_path is not null and p_photo_path not like v_user::text || '/%' then
    raise exception 'That photo isn''t yours.' using errcode = '42501';
  end if;

  select count(*) into v_count from public.event_entries x where x.event_id = p_event_id and x.user_id = v_user;

  if v_event.type in ('mystery_swap', 'showcase_contest') then
    if v_count > 0 then
      raise exception 'You can enter one item in this event.' using errcode = '23505';
    end if;
    if p_listing_id is null then
      raise exception 'Pick one of your items.' using errcode = '22023';
    end if;
  elsif v_count >= 5 then
    raise exception 'You can add up to 5 entries to this event.' using errcode = '22023';
  end if;

  if v_event.type in ('mystery_swap', 'swap_meet', 'theme_day') then
    if p_listing_id is null then
      raise exception 'Pick one of your items.' using errcode = '22023';
    end if;
    if v_listing.status <> 'available' or not v_listing.for_trade then
      raise exception 'Only items that are up for trade and available can be added.' using errcode = '22023';
    end if;
  end if;

  if v_event.type = 'unboxing_party' and p_photo_path is null then
    raise exception 'Add a photo of your unboxing.' using errcode = '22023';
  end if;

  if v_event.type = 'mystery_swap' and v_event.status <> 'upcoming' and v_event.status <> 'live' then
    raise exception 'The pool is closed.' using errcode = '22023';
  end if;

  insert into public.event_entries (event_id, user_id, listing_id, photo_path, caption)
  values (p_event_id, v_user, p_listing_id, p_photo_path, nullif(trim(p_caption), ''))
  returning id into v_id;

  -- Taking part means you're going.
  insert into public.event_rsvps (event_id, user_id) values (p_event_id, v_user) on conflict do nothing;

  -- A mystery-swap item is locked until the reveal (closes other offers on it).
  if v_event.type = 'mystery_swap' then
    update public.listings set status = 'pending' where id = p_listing_id;
  end if;

  return v_id;
end;
$$;

-- remove_event_entry: take your entry back out (before the event ends).
create or replace function public.remove_event_entry(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.event_entries;
  v_event public.events;
begin
  select * into v_entry from public.event_entries where id = p_entry_id;
  if not found or v_entry.user_id <> auth.uid() then
    raise exception 'Entry not found.' using errcode = '42501';
  end if;
  select * into v_event from public.events where id = v_entry.event_id;
  if v_event.status = 'ended' then
    raise exception 'This event has ended.' using errcode = '22023';
  end if;

  delete from public.event_entries where id = p_entry_id;

  if v_event.type = 'mystery_swap' and v_entry.listing_id is not null then
    update public.listings set status = 'available'
     where id = v_entry.listing_id and owner_id = v_entry.user_id and status = 'pending';
  end if;
end;
$$;

-- toggle_event_vote: heart an entry (or vote in a contest). Tap again to
-- undo. In a contest you get ONE vote: voting for another entry moves it.
create or replace function public.toggle_event_vote(p_entry_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_entry public.event_entries;
  v_event public.events;
begin
  select * into v_entry from public.event_entries where id = p_entry_id;
  if not found or v_user is null then
    raise exception 'Entry not found.' using errcode = 'P0002';
  end if;
  select * into v_event from public.events where id = v_entry.event_id;

  if v_entry.user_id = v_user then
    raise exception 'You can''t vote for your own entry.' using errcode = '42501';
  end if;
  if v_event.type = 'mystery_swap' then
    raise exception 'There''s no voting in a mystery swap.' using errcode = '22023';
  end if;
  if v_event.status = 'ended' then
    raise exception 'Voting has closed.' using errcode = '22023';
  end if;
  if v_event.type = 'showcase_contest' and v_event.status <> 'live' then
    raise exception 'Voting opens when the host starts the contest.' using errcode = '22023';
  end if;

  if exists (select 1 from public.event_votes v where v.entry_id = p_entry_id and v.voter_id = v_user) then
    delete from public.event_votes where entry_id = p_entry_id and voter_id = v_user;
    return false;
  end if;

  if v_event.type = 'showcase_contest' then
    delete from public.event_votes where event_id = v_event.id and voter_id = v_user;
  end if;

  insert into public.event_votes (entry_id, event_id, voter_id) values (p_entry_id, v_event.id, v_user);
  return true;
end;
$$;

-- run_mystery_swap: the host shuffles the pool. Each person's item goes
-- to the next person in a random circle, so nobody gets their own item.
-- Items change owner right away (virtual swap) and the event ends.
create or replace function public.run_mystery_swap(p_event_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events;
  v_entries uuid[];
  v_n int;
  v_giver public.event_entries;
  v_receiver_user uuid;
begin
  select * into v_event from public.events where id = p_event_id for update;
  if not found or not public.can_host_event(p_event_id) then
    raise exception 'Only the host can do that.' using errcode = '42501';
  end if;
  if v_event.type <> 'mystery_swap' then
    raise exception 'This isn''t a mystery swap.' using errcode = '22023';
  end if;
  if v_event.status = 'ended' then
    raise exception 'This mystery swap has already been revealed.' using errcode = '22023';
  end if;

  select array_agg(x.id order by random()) into v_entries
  from public.event_entries x where x.event_id = p_event_id and x.listing_id is not null;
  v_n := coalesce(array_length(v_entries, 1), 0);
  if v_n < 2 then
    raise exception 'You need at least 2 items in the pool to swap.' using errcode = '22023';
  end if;

  for i in 1 .. v_n loop
    select * into v_giver from public.event_entries where id = v_entries[i];
    select x.user_id into v_receiver_user from public.event_entries x where x.id = v_entries[(i % v_n) + 1];

    update public.listings
       set owner_id = v_receiver_user, status = 'available', for_trade = false, looking_for = null
     where id = v_giver.listing_id;
    delete from public.listing_wants where listing_id = v_giver.listing_id and user_id = v_receiver_user;

    insert into public.listing_transfers (listing_id, from_user, to_user, event_id)
    values (v_giver.listing_id, v_giver.user_id, v_receiver_user, p_event_id);

    update public.event_entries set receiver_id = v_receiver_user where id = v_giver.id;
  end loop;

  update public.events set status = 'ended', revealed_at = now() where id = p_event_id;
  return v_n;
end;
$$;

revoke execute on function public.set_event_status(uuid, public.event_status) from public, anon;
revoke execute on function public.add_event_entry(uuid, uuid, text, text) from public, anon;
revoke execute on function public.remove_event_entry(uuid) from public, anon;
revoke execute on function public.toggle_event_vote(uuid) from public, anon;
revoke execute on function public.run_mystery_swap(uuid) from public, anon;
revoke execute on function public.can_host_event(uuid) from public, anon;
grant execute on function public.set_event_status(uuid, public.event_status) to authenticated;
grant execute on function public.add_event_entry(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_event_entry(uuid) to authenticated;
grant execute on function public.toggle_event_vote(uuid) to authenticated;
grant execute on function public.run_mystery_swap(uuid) to authenticated;
grant execute on function public.can_host_event(uuid) to authenticated;


-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.events        enable row level security;
alter table public.event_rsvps   enable row level security;
alter table public.event_entries enable row level security;
alter table public.event_votes   enable row level security;

create policy "Logged-in users can view events"
  on public.events for select to authenticated using (true);
create policy "Members can create events in their communities"
  on public.events for insert to authenticated
  with check (created_by = (select auth.uid()) and public.is_member(community_id));
create policy "Hosts can delete their events"
  on public.events for delete to authenticated
  using (created_by = (select auth.uid()));

-- Status changes go through set_event_status / run_mystery_swap.
revoke insert, update on public.events from anon, authenticated;
grant insert (community_id, created_by, type, title, description, theme, starts_at, place, mini_activity)
  on public.events to authenticated;

create policy "Logged-in users can see who's going"
  on public.event_rsvps for select to authenticated using (true);
create policy "Users can RSVP"
  on public.event_rsvps for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can un-RSVP"
  on public.event_rsvps for delete to authenticated
  using (user_id = (select auth.uid()));

-- Entries and votes are public; changes go through the functions above.
create policy "Logged-in users can view event entries"
  on public.event_entries for select to authenticated using (true);
create policy "Logged-in users can view event votes"
  on public.event_votes for select to authenticated using (true);


-- =====================================================================
-- REALTIME: event pages update live (new entries, votes, reveal).
-- =====================================================================
alter publication supabase_realtime add table public.events;
alter publication supabase_realtime add table public.event_entries;
alter publication supabase_realtime add table public.event_votes;


-- =====================================================================
-- QR ROOMS: the join page shows the community's name and description to
-- people who don't have an account yet (they type a name right there).
-- =====================================================================
create policy "Anyone can preview communities"
  on public.communities for select to anon
  using (true);
