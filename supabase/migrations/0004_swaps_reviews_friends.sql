-- =====================================================================
-- 0004_swaps_reviews_friends.sql  (Phase 4)
-- The virtual swap room (proof photos, both confirm, items change
-- owners), each item's trade journey, reviews + ratings, and friends.
-- Run after 0003_negotiation.sql.
-- =====================================================================


-- =====================================================================
-- ITEM JOURNEY: every time an item changes owner
-- =====================================================================
create table public.listing_transfers (
  id         uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  from_user  uuid references public.profiles (id) on delete set null,
  to_user    uuid references public.profiles (id) on delete set null,
  trade_id   uuid references public.trades (id) on delete set null,
  -- set when the item moved in a community event (e.g. a mystery swap)
  event_id   uuid,
  created_at timestamptz not null default now()
);

create index listing_transfers_listing_idx on public.listing_transfers (listing_id, created_at);


-- =====================================================================
-- PROOF PHOTOS ("check before you swap")
-- Stored in a PRIVATE bucket: trade-photos/<trade id>/<user id>/<file>
-- =====================================================================
create table public.trade_photos (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades (id) on delete cascade,
  uploader_id uuid not null references public.profiles (id) on delete cascade,
  path        text not null,
  caption     text check (char_length(caption) <= 200),
  created_at  timestamptz not null default now()
);

create index trade_photos_trade_idx on public.trade_photos (trade_id, created_at);


-- =====================================================================
-- REVIEWS (one per person per completed trade)
-- =====================================================================
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  trade_id    uuid not null references public.trades (id) on delete cascade,
  reviewer_id uuid not null references public.profiles (id) on delete cascade,
  reviewee_id uuid not null references public.profiles (id) on delete cascade,
  rating      smallint not null check (rating between 1 and 5),
  tags        text[] not null default '{}'
              check (tags <@ array['good_trade', 'trustworthy', 'flexible', 'as_described']::text[]),
  comment     text check (char_length(comment) <= 500),
  created_at  timestamptz not null default now(),
  unique (trade_id, reviewer_id),
  check (reviewer_id <> reviewee_id)
);

create index reviews_reviewee_idx on public.reviews (reviewee_id, created_at desc);


-- =====================================================================
-- FRIENDS: "Add friend" (one way). Mutual friends = people you've both added.
-- =====================================================================
create table public.friends (
  user_id    uuid not null references public.profiles (id) on delete cascade,  -- who added
  friend_id  uuid not null references public.profiles (id) on delete cascade,  -- who was added
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

create index friends_friend_idx on public.friends (friend_id);


-- =====================================================================
-- SWAP ACTIONS
-- =====================================================================

-- confirm_swap: you confirm the agreed deal. When BOTH people have
-- confirmed, every item changes owner (it lands in the new owner's
-- Showcase), the journey is recorded, the trade becomes "completed" and
-- both traders' completed-trade counts go up.
create or replace function public.confirm_swap(p_trade_id uuid)
returns public.trade_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_trade public.trades;
  v_name text;
  v_item record;
  v_receiver uuid;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found or v_user is null or v_user not in (v_trade.sender_id, v_trade.recipient_id) then
    raise exception 'Swap not found.' using errcode = '42501';
  end if;
  if v_trade.status <> 'planning' then
    raise exception 'This swap is already %.', v_trade.status using errcode = '22023';
  end if;

  select display_name into v_name from public.profiles where id = v_user;

  if v_user = v_trade.sender_id and v_trade.sender_confirmed_at is null then
    update public.trades set sender_confirmed_at = now() where id = p_trade_id returning * into v_trade;
    insert into public.trade_messages (offer_id, kind, body)
    values (v_trade.offer_id, 'system', format('%s confirmed the swap.', v_name));
  elsif v_user = v_trade.recipient_id and v_trade.recipient_confirmed_at is null then
    update public.trades set recipient_confirmed_at = now() where id = p_trade_id returning * into v_trade;
    insert into public.trade_messages (offer_id, kind, body)
    values (v_trade.offer_id, 'system', format('%s confirmed the swap.', v_name));
  end if;

  -- Not both yet? Wait for the other person.
  if v_trade.sender_confirmed_at is null or v_trade.recipient_confirmed_at is null then
    return v_trade.status;
  end if;

  -- Both confirmed: move every item to the other person.
  for v_item in
    select oi.listing_id, oi.giver_id from public.offer_items oi where oi.round_id = v_trade.round_id
  loop
    v_receiver := case when v_item.giver_id = v_trade.sender_id then v_trade.recipient_id else v_trade.sender_id end;

    update public.listings
       set owner_id = v_receiver,
           status = 'available',
           for_trade = false,      -- lands in the new owner's Showcase
           looking_for = null
     where id = v_item.listing_id;

    -- The new owner can't "want" their own item any more.
    delete from public.listing_wants where listing_id = v_item.listing_id and user_id = v_receiver;

    insert into public.listing_transfers (listing_id, from_user, to_user, trade_id)
    values (v_item.listing_id, v_item.giver_id, v_receiver, p_trade_id);
  end loop;

  update public.trades set status = 'completed', completed_at = now() where id = p_trade_id;
  update public.profiles set trades_completed = trades_completed + 1
   where id in (v_trade.sender_id, v_trade.recipient_id);

  insert into public.trade_messages (offer_id, kind, body)
  values (v_trade.offer_id, 'system', 'Swap complete! The items are now in each other''s collections.');

  return 'completed';
end;
$$;

-- cancel_trade: either person calls off the swap before it's complete.
-- The items go back to being available.
create or replace function public.cancel_trade(p_trade_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_trade public.trades;
  v_name text;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found or v_user is null or v_user not in (v_trade.sender_id, v_trade.recipient_id) then
    raise exception 'Swap not found.' using errcode = '42501';
  end if;
  if v_trade.status <> 'planning' then
    raise exception 'This swap is already %.', v_trade.status using errcode = '22023';
  end if;

  update public.trades
     set status = 'cancelled', cancelled_at = now(), cancelled_by = v_user
   where id = p_trade_id;

  update public.listings set status = 'available'
   where id in (select oi.listing_id from public.offer_items oi where oi.round_id = v_trade.round_id)
     and status = 'pending';

  select display_name into v_name from public.profiles where id = v_user;
  insert into public.trade_messages (offer_id, kind, body)
  values (v_trade.offer_id, 'system', format('%s cancelled the swap. The items are available again.', v_name));
end;
$$;

-- leave_review: after a completed swap, rate the other person once.
create or replace function public.leave_review(
  p_trade_id uuid,
  p_rating int,
  p_tags text[] default '{}',
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_trade public.trades;
  v_reviewee uuid;
  v_id uuid;
  v_name text;
begin
  select * into v_trade from public.trades where id = p_trade_id;
  if not found or v_user is null or v_user not in (v_trade.sender_id, v_trade.recipient_id) then
    raise exception 'Swap not found.' using errcode = '42501';
  end if;
  if v_trade.status <> 'completed' then
    raise exception 'You can review once the swap is complete.' using errcode = '22023';
  end if;
  if exists (select 1 from public.reviews r where r.trade_id = p_trade_id and r.reviewer_id = v_user) then
    raise exception 'You already reviewed this swap.' using errcode = '23505';
  end if;

  v_reviewee := case when v_user = v_trade.sender_id then v_trade.recipient_id else v_trade.sender_id end;

  insert into public.reviews (trade_id, reviewer_id, reviewee_id, rating, tags, comment)
  values (p_trade_id, v_user, v_reviewee, p_rating, coalesce(p_tags, '{}'), nullif(trim(p_comment), ''))
  returning id into v_id;

  -- Refresh the reviewee's trader badge numbers.
  update public.profiles p
     set rating_count = s.n, rating_avg = s.avg
    from (
      select count(*)::int as n, round(avg(r.rating)::numeric, 2) as avg
      from public.reviews r where r.reviewee_id = v_reviewee
    ) s
   where p.id = v_reviewee;

  select display_name into v_name from public.profiles where id = v_user;
  insert into public.trade_messages (offer_id, kind, body)
  values (v_trade.offer_id, 'system', format('%s left a review.', v_name));

  return v_id;
end;
$$;

revoke execute on function public.confirm_swap(uuid) from public, anon;
revoke execute on function public.cancel_trade(uuid) from public, anon;
revoke execute on function public.leave_review(uuid, int, text[], text) from public, anon;
grant execute on function public.confirm_swap(uuid) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.leave_review(uuid, int, text[], text) to authenticated;


-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.listing_transfers enable row level security;
alter table public.trade_photos      enable row level security;
alter table public.reviews           enable row level security;
alter table public.friends           enable row level security;

-- The journey of an item is public (it's part of the fun).
create policy "Logged-in users can view item journeys"
  on public.listing_transfers for select to authenticated using (true);

-- Proof photos: only the two traders, while the swap is being arranged.
create policy "Traders can view proof photos"
  on public.trade_photos for select to authenticated
  using (
    exists (
      select 1 from public.trades t
      where t.id = trade_id and (select auth.uid()) in (t.sender_id, t.recipient_id)
    )
  );
create policy "Traders can add proof photos"
  on public.trade_photos for insert to authenticated
  with check (
    uploader_id = (select auth.uid())
    and path like trade_id::text || '/' || (select auth.uid())::text || '/%'
    and exists (
      select 1 from public.trades t
      where t.id = trade_id and t.status = 'planning'
        and (select auth.uid()) in (t.sender_id, t.recipient_id)
    )
  );

-- Reviews are public; they're written through leave_review().
create policy "Logged-in users can view reviews"
  on public.reviews for select to authenticated using (true);

-- Friends lists are public; you can only add/remove your own.
create policy "Logged-in users can view friends"
  on public.friends for select to authenticated using (true);
create policy "Users can add friends"
  on public.friends for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Users can remove friends"
  on public.friends for delete to authenticated
  using (user_id = (select auth.uid()));


-- =====================================================================
-- STORAGE: private trade-photos bucket (only the two traders)
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trade-photos', 'trade-photos', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "Traders can view their trade photos"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trade-photos'
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and (select auth.uid()) in (t.sender_id, t.recipient_id)
    )
  );

create policy "Traders can upload their own trade photos"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trade-photos'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.trades t
      where t.id::text = (storage.foldername(name))[1]
        and t.status = 'planning'
        and (select auth.uid()) in (t.sender_id, t.recipient_id)
    )
  );


-- =====================================================================
-- REALTIME: live "people joined" counter on the room's host screen.
-- =====================================================================
alter publication supabase_realtime add table public.community_members;
