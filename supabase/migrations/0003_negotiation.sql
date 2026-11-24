-- =====================================================================
-- 0003_negotiation.sql  (Phase 3)
-- Rarity, rarity votes, "I want this" hearts, trade matches, and the
-- negotiation room: offers with counter-offer rounds, multi-item
-- proposals, chat messages (Realtime), and accepting an offer into a trade.
-- Run after 0002_communities_listings.sql.
-- =====================================================================


-- =====================================================================
-- RARITY (feeds the fairness meter)
-- =====================================================================
create type public.listing_rarity as enum ('common', 'uncommon', 'rare', 'secret', 'unsure');

alter table public.listings
  add column rarity public.listing_rarity not null default 'unsure';

grant insert (rarity), update (rarity) on public.listings to authenticated;

-- Search listing titles quickly (used by trade matches).
create index listings_title_search_idx
  on public.listings using gin (to_tsvector('english', title));


-- ---------------------------------------------------------------------
-- create_listing / update_listing now take a rarity.
-- (A function's inputs can't be changed in place, so we drop and recreate.)
-- ---------------------------------------------------------------------
drop function public.create_listing(uuid, text, text, public.listing_condition, text, text, boolean, text[]);
drop function public.update_listing(uuid, uuid, text, text, public.listing_condition, text, text, boolean, text[]);

create function public.create_listing(
  p_community_id uuid,
  p_title text,
  p_description text,
  p_condition public.listing_condition,
  p_rarity public.listing_rarity,
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
    (owner_id, community_id, title, description, condition, rarity, size, looking_for, for_trade)
  values (
    v_user, p_community_id, trim(p_title), coalesce(trim(p_description), ''), p_condition,
    coalesce(p_rarity, 'unsure'), nullif(trim(p_size), ''), nullif(trim(p_looking_for), ''),
    coalesce(p_for_trade, true)
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

-- update_listing runs with elevated rights (security definer) so that a
-- listing you received in a swap can keep its photos, which live in the
-- previous owner's folder. It therefore checks ownership itself.
create function public.update_listing(
  p_listing_id uuid,
  p_community_id uuid,
  p_title text,
  p_description text,
  p_condition public.listing_condition,
  p_rarity public.listing_rarity,
  p_size text,
  p_looking_for text,
  p_for_trade boolean,
  p_image_paths text[]
)
returns text[]
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_count int := coalesce(array_length(p_image_paths, 1), 0);
  v_removed text[];
  v_path text;
begin
  if v_user is null then
    raise exception 'You need to be logged in.' using errcode = '28000';
  end if;
  if v_count not between 1 and 4 then
    raise exception 'Add between 1 and 4 photos.' using errcode = '22023';
  end if;

  perform 1 from public.listings l
  where l.id = p_listing_id and l.owner_id = v_user and l.status = 'available'
  for update;
  if not found then
    raise exception 'You can only edit your own listings while they are available.'
      using errcode = '42501';
  end if;

  if not exists (select 1 from public.communities c where c.id = p_community_id) then
    raise exception 'Choose a community.' using errcode = '22023';
  end if;

  -- Each photo must be a new upload in your folder, or already on this listing.
  foreach v_path in array p_image_paths loop
    if v_path not like v_user::text || '/%'
       and not exists (
         select 1 from public.listing_images li
         where li.listing_id = p_listing_id and li.path = v_path
       ) then
      raise exception 'One of those photos isn''t yours.' using errcode = '42501';
    end if;
  end loop;

  update public.listings set
    community_id = p_community_id,
    title        = trim(p_title),
    description  = coalesce(trim(p_description), ''),
    condition    = p_condition,
    rarity       = coalesce(p_rarity, 'unsure'),
    size         = nullif(trim(p_size), ''),
    looking_for  = nullif(trim(p_looking_for), ''),
    for_trade    = coalesce(p_for_trade, true)
  where id = p_listing_id;

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

revoke execute on function public.create_listing(uuid, text, text, public.listing_condition, public.listing_rarity, text, text, boolean, text[]) from public, anon;
revoke execute on function public.update_listing(uuid, uuid, text, text, public.listing_condition, public.listing_rarity, text, text, boolean, text[]) from public, anon;
grant execute on function public.create_listing(uuid, text, text, public.listing_condition, public.listing_rarity, text, text, boolean, text[]) to authenticated;
grant execute on function public.update_listing(uuid, uuid, text, text, public.listing_condition, public.listing_rarity, text, text, boolean, text[]) to authenticated;


-- =====================================================================
-- RARITY VOTES ("What rarity do you think this is?")
-- After 3+ votes the community's pick is used by the fairness meter.
-- =====================================================================
create table public.listing_rarity_votes (
  listing_id uuid not null references public.listings (id) on delete cascade,
  voter_id   uuid not null references public.profiles (id) on delete cascade,
  rarity     public.listing_rarity not null check (rarity <> 'unsure'),
  created_at timestamptz not null default now(),
  primary key (listing_id, voter_id)
);


-- =====================================================================
-- "I WANT THIS" HEARTS
-- =====================================================================
create table public.listing_wants (
  listing_id uuid not null references public.listings (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (listing_id, user_id)
);

create index listing_wants_user_idx on public.listing_wants (user_id);


-- =====================================================================
-- NEGOTIATION: offers -> rounds (each proposal) -> items
-- =====================================================================
create type public.offer_status as enum ('pending', 'accepted', 'declined', 'cancelled');
create type public.message_kind as enum ('text', 'proposal', 'system');
create type public.trade_status as enum ('planning', 'completed', 'cancelled');

-- One negotiation between two people, started from one listing.
create table public.offers (
  id               uuid primary key default gen_random_uuid(),
  -- the listing that started it (kept even if the deal changes)
  listing_id       uuid references public.listings (id) on delete set null,
  sender_id        uuid not null references public.profiles (id) on delete cascade,  -- started it
  recipient_id     uuid not null references public.profiles (id) on delete cascade,  -- listing owner
  status           public.offer_status not null default 'pending',
  current_round_id uuid,                -- latest proposal (foreign key added below)
  closed_reason    text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (sender_id <> recipient_id)
);

create index offers_listing_idx on public.offers (listing_id);
create index offers_sender_idx on public.offers (sender_id, updated_at desc);
create index offers_recipient_idx on public.offers (recipient_id, updated_at desc);

create trigger offers_set_updated_at
  before update on public.offers
  for each row execute function public.set_updated_at();

-- Each proposal or counter-offer is a "round".
create table public.offer_rounds (
  id          uuid primary key default gen_random_uuid(),
  offer_id    uuid not null references public.offers (id) on delete cascade,
  round_no    int not null,
  proposed_by uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (offer_id, round_no)
);

alter table public.offers
  add constraint offers_current_round_id_fkey
  foreign key (current_round_id) references public.offer_rounds (id) on delete set null;

-- Which listings are in a round. giver_id = whose item it is (their side).
create table public.offer_items (
  round_id   uuid not null references public.offer_rounds (id) on delete cascade,
  listing_id uuid not null references public.listings (id) on delete cascade,
  giver_id   uuid not null references public.profiles (id) on delete cascade,
  primary key (round_id, listing_id)
);

create index offer_items_listing_idx on public.offer_items (listing_id);

-- The chat for a negotiation. It carries on into the trade room.
create table public.trade_messages (
  id         uuid primary key default gen_random_uuid(),
  offer_id   uuid not null references public.offers (id) on delete cascade,
  sender_id  uuid references public.profiles (id) on delete set null,  -- null = system message
  kind       public.message_kind not null default 'text',
  body       text not null check (char_length(body) between 1 and 1000),
  round_id   uuid references public.offer_rounds (id) on delete set null,  -- for proposals
  created_at timestamptz not null default now()
);

create index trade_messages_offer_idx on public.trade_messages (offer_id, created_at);

-- An accepted negotiation becomes a trade (the swap room, Phase 4).
create table public.trades (
  id                     uuid primary key default gen_random_uuid(),
  offer_id               uuid not null unique references public.offers (id) on delete cascade,
  round_id               uuid not null references public.offer_rounds (id),  -- the agreed deal
  sender_id              uuid not null references public.profiles (id) on delete cascade,
  recipient_id           uuid not null references public.profiles (id) on delete cascade,
  status                 public.trade_status not null default 'planning',
  sender_confirmed_at    timestamptz,
  recipient_confirmed_at timestamptz,
  completed_at           timestamptz,
  cancelled_at           timestamptz,
  cancelled_by           uuid references public.profiles (id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index trades_sender_idx on public.trades (sender_id, created_at desc);
create index trades_recipient_idx on public.trades (recipient_id, created_at desc);

create trigger trades_set_updated_at
  before update on public.trades
  for each row execute function public.set_updated_at();


-- =====================================================================
-- HELPERS
-- =====================================================================

-- Is the logged-in user one of the two people in this negotiation?
create or replace function public.is_offer_participant(p_offer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.offers o
    where o.id = p_offer_id and auth.uid() in (o.sender_id, o.recipient_id)
  );
$$;

-- How many open negotiations include this listing (shown on the listing page).
create or replace function public.open_offer_count(p_listing_id uuid)
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct o.id)::int
  from public.offers o
  left join public.offer_items oi on oi.round_id = o.current_round_id
  where o.status = 'pending' and (o.listing_id = p_listing_id or oi.listing_id = p_listing_id);
$$;

-- Closes (declines) every open negotiation that includes a listing,
-- leaving a note in each chat. Used when an item stops being available.
create or replace function public.close_offers_for_listing(p_listing_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer_id uuid;
begin
  for v_offer_id in
    select distinct o.id
    from public.offers o
    left join public.offer_items oi on oi.round_id = o.current_round_id
    where o.status = 'pending' and (o.listing_id = p_listing_id or oi.listing_id = p_listing_id)
  loop
    update public.offers set status = 'declined', closed_reason = p_reason where id = v_offer_id;
    insert into public.trade_messages (offer_id, kind, body) values (v_offer_id, 'system', p_reason);
  end loop;
end;
$$;

-- When a listing is locked in another trade, switched to showcase, or
-- deleted, any negotiation that includes it is closed automatically.
create or replace function public.on_listing_unavailable()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    perform public.close_offers_for_listing(old.id, format('"%s" was deleted by its owner.', old.title));
    return old;
  end if;

  if old.status = 'available' and new.status <> 'available' then
    perform public.close_offers_for_listing(new.id, format('"%s" is now part of another trade.', new.title));
  elsif old.for_trade and not new.for_trade then
    perform public.close_offers_for_listing(new.id, format('"%s" is no longer up for trade.', new.title));
  end if;
  return new;
end;
$$;

create trigger listings_close_offers_on_update
  after update of status, for_trade on public.listings
  for each row execute function public.on_listing_unavailable();

create trigger listings_close_offers_on_delete
  before delete on public.listings
  for each row execute function public.on_listing_unavailable();


-- ---------------------------------------------------------------------
-- create_offer_round (internal): checks a proposal and saves it.
-- Rules: up to 12 items, at least one from each person, every item must
-- belong to one of the two people, be available and be up for trade.
-- ---------------------------------------------------------------------
create or replace function public.create_offer_round(
  p_offer_id uuid,
  p_proposer uuid,
  p_listing_ids uuid[],
  p_message text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_ids uuid[];
  v_bad int;
  v_sender_items int;
  v_recipient_items int;
  v_round_no int;
  v_round_id uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id;

  if char_length(coalesce(p_message, '')) > 1000 then
    raise exception 'Keep your message under 1000 characters.' using errcode = '22023';
  end if;

  select coalesce(array_agg(distinct x), '{}') into v_ids
  from unnest(p_listing_ids) as x
  where x is not null;

  if array_length(v_ids, 1) > 12 then
    raise exception 'A proposal can include up to 12 items.' using errcode = '22023';
  end if;

  select count(*) into v_bad
  from unnest(v_ids) as x(id)
  left join public.listings l on l.id = x.id
  where l.id is null
     or l.owner_id not in (v_offer.sender_id, v_offer.recipient_id)
     or l.status <> 'available'
     or not l.for_trade;
  if v_bad > 0 then
    raise exception 'Some items can''t be included: each one must belong to one of you, be available, and be up for trade.'
      using errcode = '22023';
  end if;

  select count(*) filter (where l.owner_id = v_offer.sender_id),
         count(*) filter (where l.owner_id = v_offer.recipient_id)
    into v_sender_items, v_recipient_items
  from public.listings l
  where l.id = any (v_ids);
  if v_sender_items = 0 or v_recipient_items = 0 then
    raise exception 'A proposal needs at least one item from each of you.' using errcode = '22023';
  end if;

  select coalesce(max(r.round_no), 0) + 1 into v_round_no
  from public.offer_rounds r where r.offer_id = p_offer_id;

  insert into public.offer_rounds (offer_id, round_no, proposed_by)
  values (p_offer_id, v_round_no, p_proposer)
  returning id into v_round_id;

  insert into public.offer_items (round_id, listing_id, giver_id)
  select v_round_id, l.id, l.owner_id from public.listings l where l.id = any (v_ids);

  update public.offers set current_round_id = v_round_id where id = p_offer_id;

  insert into public.trade_messages (offer_id, sender_id, kind, body, round_id)
  values (
    p_offer_id, p_proposer, 'proposal',
    coalesce(
      nullif(trim(p_message), ''),
      case when v_round_no = 1 then 'Sent an offer.' else 'Sent a counter-offer.' end
    ),
    v_round_id
  );

  return v_round_id;
end;
$$;


-- =====================================================================
-- THE NEGOTIATION ACTIONS (called from the app)
-- =====================================================================

-- start_offer: open a negotiation on someone else's listing.
-- p_listing_ids = everything in your first proposal (your items, plus any
-- extra items of theirs you'd like). Their listing is always included.
create or replace function public.start_offer(
  p_listing_id uuid,
  p_listing_ids uuid[],
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_target public.listings;
  v_offer_id uuid;
begin
  if v_user is null then
    raise exception 'You need to be logged in.' using errcode = '28000';
  end if;

  select * into v_target from public.listings where id = p_listing_id;
  if not found then
    raise exception 'That listing no longer exists.' using errcode = 'P0002';
  end if;
  if v_target.owner_id = v_user then
    raise exception 'You can''t make an offer on your own listing.' using errcode = '42501';
  end if;
  if v_target.status <> 'available' or not v_target.for_trade then
    raise exception 'This item isn''t available for trade right now.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.offers o
    where o.listing_id = p_listing_id and o.sender_id = v_user and o.status = 'pending'
  ) then
    raise exception 'You already have an open negotiation for this item.' using errcode = '23505';
  end if;

  insert into public.offers (listing_id, sender_id, recipient_id)
  values (p_listing_id, v_user, v_target.owner_id)
  returning id into v_offer_id;

  perform public.create_offer_round(
    v_offer_id, v_user, array_append(coalesce(p_listing_ids, '{}'), p_listing_id), p_message
  );

  return v_offer_id;
end;
$$;

-- counter_offer: either person proposes a new set of items.
create or replace function public.counter_offer(
  p_offer_id uuid,
  p_listing_ids uuid[],
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_offer public.offers;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_user is null or v_user not in (v_offer.sender_id, v_offer.recipient_id) then
    raise exception 'Negotiation not found.' using errcode = '42501';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This negotiation is already closed.' using errcode = '22023';
  end if;

  return public.create_offer_round(p_offer_id, v_user, p_listing_ids, p_message);
end;
$$;

-- accept_offer: accept the latest proposal. Only the person who did NOT
-- send it can accept. Creates the trade, locks every item in it
-- (status = pending), and the listing trigger above automatically
-- declines every other open negotiation that includes those items.
create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_offer public.offers;
  v_round public.offer_rounds;
  v_ids uuid[];
  v_problems int;
  v_trade_id uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_user is null or v_user not in (v_offer.sender_id, v_offer.recipient_id) then
    raise exception 'Negotiation not found.' using errcode = '42501';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This negotiation is already closed.' using errcode = '22023';
  end if;

  select * into v_round from public.offer_rounds where id = v_offer.current_round_id;
  if v_round.proposed_by = v_user then
    raise exception 'You sent the latest proposal. Wait for the other person to accept or counter it.'
      using errcode = '42501';
  end if;

  select array_agg(oi.listing_id) into v_ids
  from public.offer_items oi where oi.round_id = v_round.id;

  -- Lock the items, then make sure nothing changed since the proposal.
  perform 1 from public.listings l where l.id = any (v_ids) for update;
  select count(*) into v_problems
  from public.offer_items oi
  left join public.listings l on l.id = oi.listing_id
  where oi.round_id = v_round.id
    and (l.id is null or l.owner_id <> oi.giver_id or l.status <> 'available' or not l.for_trade);
  if v_problems > 0 then
    raise exception 'Some items in this proposal are no longer available. Send a new proposal instead.'
      using errcode = '22023';
  end if;

  -- Order matters: mark THIS offer accepted first, so the listing trigger
  -- only closes the other negotiations.
  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.listings set status = 'pending' where id = any (v_ids);

  insert into public.trades (offer_id, round_id, sender_id, recipient_id)
  values (p_offer_id, v_round.id, v_offer.sender_id, v_offer.recipient_id)
  returning id into v_trade_id;

  insert into public.trade_messages (offer_id, kind, body)
  values (p_offer_id, 'system', 'Offer accepted! The items are locked while you get ready to swap.');

  return v_trade_id;
end;
$$;

-- decline_offer: the person who received the offer says no.
create or replace function public.decline_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_offer public.offers;
  v_name text;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_user is null or v_user <> v_offer.recipient_id then
    raise exception 'Only the person who received this offer can decline it.' using errcode = '42501';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This negotiation is already closed.' using errcode = '22023';
  end if;

  select display_name into v_name from public.profiles where id = v_user;
  update public.offers set status = 'declined', closed_reason = 'Declined.' where id = p_offer_id;
  insert into public.trade_messages (offer_id, kind, body)
  values (p_offer_id, 'system', format('%s declined the offer.', v_name));
end;
$$;

-- cancel_offer: the person who started the negotiation withdraws it.
create or replace function public.cancel_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_offer public.offers;
  v_name text;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or v_user is null or v_user <> v_offer.sender_id then
    raise exception 'Only the person who started this negotiation can cancel it.' using errcode = '42501';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This negotiation is already closed.' using errcode = '22023';
  end if;

  select display_name into v_name from public.profiles where id = v_user;
  update public.offers set status = 'cancelled', closed_reason = 'Cancelled.' where id = p_offer_id;
  insert into public.trade_messages (offer_id, kind, body)
  values (p_offer_id, 'system', format('%s cancelled the offer.', v_name));
end;
$$;


-- ---------------------------------------------------------------------
-- get_trade_matches: listings that match "Looking for" text.
--   they_have = their item matches what YOUR listing is looking for
--   you_have  = YOUR item matches what THEIR listing is looking for
--   perfect   = both at once
-- ---------------------------------------------------------------------
create or replace function public.get_trade_matches(p_limit int default 12)
returns table (my_listing_id uuid, their_listing_id uuid, match_kind text)
language sql
stable
security invoker
set search_path = ''
as $$
  with mine as (
    select l.id, l.title, l.looking_for from public.listings l
    where l.owner_id = auth.uid() and l.status = 'available' and l.for_trade
  ),
  theirs as (
    select l.id, l.title, l.looking_for from public.listings l
    where l.owner_id <> auth.uid() and l.status = 'available' and l.for_trade
  ),
  they_have as (
    select m.id as my_id, t.id as their_id
    from mine m join theirs t
      on m.looking_for is not null
     and to_tsvector('english', t.title) @@ websearch_to_tsquery('english', m.looking_for)
  ),
  you_have as (
    select m.id as my_id, t.id as their_id
    from mine m join theirs t
      on t.looking_for is not null
     and to_tsvector('english', m.title) @@ websearch_to_tsquery('english', t.looking_for)
  )
  select coalesce(a.my_id, b.my_id),
         coalesce(a.their_id, b.their_id),
         case when a.my_id is not null and b.my_id is not null then 'perfect'
              when a.my_id is not null then 'they_have'
              else 'you_have' end
  from they_have a
  full outer join you_have b on a.my_id = b.my_id and a.their_id = b.their_id
  order by (a.my_id is not null and b.my_id is not null) desc
  limit greatest(1, least(coalesce(p_limit, 12), 50));
$$;


-- ---------------------------------------------------------------------
-- Function permissions: the app may call these...
-- ---------------------------------------------------------------------
revoke execute on function public.start_offer(uuid, uuid[], text) from public, anon;
revoke execute on function public.counter_offer(uuid, uuid[], text) from public, anon;
revoke execute on function public.accept_offer(uuid) from public, anon;
revoke execute on function public.decline_offer(uuid) from public, anon;
revoke execute on function public.cancel_offer(uuid) from public, anon;
revoke execute on function public.open_offer_count(uuid) from public, anon;
revoke execute on function public.get_trade_matches(int) from public, anon;
revoke execute on function public.is_offer_participant(uuid) from public, anon;
grant execute on function public.start_offer(uuid, uuid[], text) to authenticated;
grant execute on function public.counter_offer(uuid, uuid[], text) to authenticated;
grant execute on function public.accept_offer(uuid) to authenticated;
grant execute on function public.decline_offer(uuid) to authenticated;
grant execute on function public.cancel_offer(uuid) to authenticated;
grant execute on function public.open_offer_count(uuid) to authenticated;
grant execute on function public.get_trade_matches(int) to authenticated;
grant execute on function public.is_offer_participant(uuid) to authenticated;

-- ...but these are internal helpers only.
revoke execute on function public.create_offer_round(uuid, uuid, uuid[], text) from public, anon, authenticated;
revoke execute on function public.close_offers_for_listing(uuid, text) from public, anon, authenticated;


-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.listing_rarity_votes enable row level security;
alter table public.listing_wants        enable row level security;
alter table public.offers               enable row level security;
alter table public.offer_rounds         enable row level security;
alter table public.offer_items          enable row level security;
alter table public.trade_messages       enable row level security;
alter table public.trades               enable row level security;

-- Rarity votes: everyone can see them; vote on other people's listings only.
create policy "Logged-in users can view rarity votes"
  on public.listing_rarity_votes for select to authenticated using (true);
create policy "Users can vote on others' listings"
  on public.listing_rarity_votes for insert to authenticated
  with check (
    voter_id = (select auth.uid())
    and not exists (
      select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  );
create policy "Users can change their vote"
  on public.listing_rarity_votes for update to authenticated
  using (voter_id = (select auth.uid()))
  with check (voter_id = (select auth.uid()));
create policy "Users can remove their vote"
  on public.listing_rarity_votes for delete to authenticated
  using (voter_id = (select auth.uid()));

-- Wants: everyone can see; heart other people's listings only.
create policy "Logged-in users can view wants"
  on public.listing_wants for select to authenticated using (true);
create policy "Users can want others' listings"
  on public.listing_wants for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and not exists (
      select 1 from public.listings l where l.id = listing_id and l.owner_id = (select auth.uid())
    )
  );
create policy "Users can remove their wants"
  on public.listing_wants for delete to authenticated
  using (user_id = (select auth.uid()));

-- Negotiations: only the two people involved can see anything.
-- All changes go through the functions above (no insert/update policies).
create policy "Participants can view their negotiations"
  on public.offers for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));

create policy "Participants can view proposal rounds"
  on public.offer_rounds for select to authenticated
  using (public.is_offer_participant(offer_id));

create policy "Participants can view proposal items"
  on public.offer_items for select to authenticated
  using (
    public.is_offer_participant((select r.offer_id from public.offer_rounds r where r.id = round_id))
  );

create policy "Participants can read the chat"
  on public.trade_messages for select to authenticated
  using (public.is_offer_participant(offer_id));

-- You can only send normal text messages, as yourself, while the
-- negotiation is open or accepted.
create policy "Participants can send chat messages"
  on public.trade_messages for insert to authenticated
  with check (
    kind = 'text'
    and sender_id = (select auth.uid())
    and round_id is null
    and exists (
      select 1 from public.offers o
      where o.id = offer_id
        and (select auth.uid()) in (o.sender_id, o.recipient_id)
        and o.status in ('pending', 'accepted')
    )
  );

create policy "Traders can view their trades"
  on public.trades for select to authenticated
  using ((select auth.uid()) in (sender_id, recipient_id));


-- =====================================================================
-- REALTIME: stream new chat messages to the two people in the chat.
-- (Realtime respects the security rules above.)
-- =====================================================================
alter publication supabase_realtime add table public.trade_messages;
