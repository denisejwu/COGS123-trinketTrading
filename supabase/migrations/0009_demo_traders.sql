-- =====================================================================
-- 0009_demo_traders.sql
-- Makes solo prototyping easy:
--   * DEMO TRADERS: experienced practice traders who reply instantly,
--     accept balanced offers, counter lopsided ones, chat back, confirm
--     their side of a swap and leave you a review.
--   * A WELCOME OFFER from a demo trader right after you open your pack.
--   * EXAMPLE TRADES that already happened, and LIVE EVENTS
--     (created by seed.sql through the functions below).
-- Run after 0008.
-- =====================================================================


-- ---------------------------------------------------------------------
-- Demo traders are profiles without a login. (Normal profiles still get
-- created by the sign-up trigger; we only stop REQUIRING a login row.)
-- ---------------------------------------------------------------------
alter table public.profiles drop constraint if exists profiles_id_fkey;
alter table public.profiles add column is_demo boolean not null default false;

-- Without that link, deleting a login (e.g. in the Supabase dashboard)
-- has to remove the profile itself.
create or replace function public.handle_user_deleted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.profiles where id = old.id;
  return old;
end;
$$;

create trigger on_auth_user_deleted
  after delete on auth.users
  for each row execute function public.handle_user_deleted();

-- Trader level, picked at random when you open your starter pack.
-- 'experienced' people start with a short trading history (see
-- _give_trading_history below); everyone else starts as 'new'.
alter table public.profiles add column trader_level text not null default 'new'
  check (trader_level in ('new', 'experienced'));

create or replace function public.is_demo(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select p.is_demo from public.profiles p where p.id = p_user), false);
$$;

-- Messages created in the same moment keep the order they were written in.
alter table public.trade_messages  alter column created_at set default clock_timestamp();
alter table public.direct_messages alter column created_at set default clock_timestamp();
alter table public.room_messages   alter column created_at set default clock_timestamp();
alter table public.notifications   alter column created_at set default clock_timestamp();

-- Fairness points in SQL (same rule as src/lib/fairness.ts).
create or replace function public.listing_points(p_rarity public.listing_rarity, p_condition public.listing_condition)
returns numeric
language sql
immutable
as $$
  select round(
    (case p_rarity when 'common' then 1 when 'uncommon' then 2 when 'rare' then 4 when 'secret' then 8 else 1 end)
    * (case p_condition when 'sealed' then 1 when 'like_new' then 0.9 when 'gently_used' then 0.7 else 0.5 end),
    1);
$$;


-- =====================================================================
-- The trade actions, rewritten so a demo trader can perform them too.
-- The public versions (start_offer, accept_offer, confirm_swap,
-- leave_review) still act as the logged-in user; the "_as" versions
-- take the actor and are ONLY callable from inside the database.
-- =====================================================================

create or replace function public._start_offer_as(
  p_listing_id uuid, p_listing_ids uuid[], p_message text, p_actor uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.listings;
  v_offer_id uuid;
begin
  if p_actor is null then
    raise exception 'You need to be logged in.' using errcode = '28000';
  end if;
  select * into v_target from public.listings where id = p_listing_id;
  if not found then
    raise exception 'That listing no longer exists.' using errcode = 'P0002';
  end if;
  if v_target.owner_id = p_actor then
    raise exception 'You can''t make an offer on your own listing.' using errcode = '42501';
  end if;
  if v_target.status <> 'available' or not v_target.for_trade then
    raise exception 'This item isn''t available for trade right now.' using errcode = '22023';
  end if;
  if exists (
    select 1 from public.offers o
    where o.listing_id = p_listing_id and o.sender_id = p_actor and o.status = 'pending'
  ) then
    raise exception 'You already have an open negotiation for this item.' using errcode = '23505';
  end if;

  insert into public.offers (listing_id, sender_id, recipient_id)
  values (p_listing_id, p_actor, v_target.owner_id)
  returning id into v_offer_id;

  perform public.create_offer_round(
    v_offer_id, p_actor, array_append(coalesce(p_listing_ids, '{}'), p_listing_id), p_message
  );
  return v_offer_id;
end;
$$;

create or replace function public.start_offer(p_listing_id uuid, p_listing_ids uuid[], p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._start_offer_as(p_listing_id, p_listing_ids, p_message, auth.uid());
end;
$$;

create or replace function public._accept_offer_as(p_offer_id uuid, p_actor uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_round public.offer_rounds;
  v_ids uuid[];
  v_problems int;
  v_trade_id uuid;
begin
  select * into v_offer from public.offers where id = p_offer_id for update;
  if not found or p_actor is null or p_actor not in (v_offer.sender_id, v_offer.recipient_id) then
    raise exception 'Negotiation not found.' using errcode = '42501';
  end if;
  if v_offer.status <> 'pending' then
    raise exception 'This negotiation is already closed.' using errcode = '22023';
  end if;

  select * into v_round from public.offer_rounds where id = v_offer.current_round_id;
  if v_round.proposed_by = p_actor then
    raise exception 'You sent the latest proposal. Wait for the other person to accept or counter it.'
      using errcode = '42501';
  end if;

  select array_agg(oi.listing_id) into v_ids from public.offer_items oi where oi.round_id = v_round.id;

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

  update public.offers set status = 'accepted' where id = p_offer_id;
  update public.listings set status = 'pending' where id = any (v_ids);

  insert into public.trade_messages (offer_id, kind, body)
  values (p_offer_id, 'system', 'Offer accepted! The items are locked while you get ready to swap.');

  insert into public.trades (offer_id, round_id, sender_id, recipient_id)
  values (p_offer_id, v_round.id, v_offer.sender_id, v_offer.recipient_id)
  returning id into v_trade_id;

  return v_trade_id;
end;
$$;

create or replace function public.accept_offer(p_offer_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._accept_offer_as(p_offer_id, auth.uid());
end;
$$;

create or replace function public._confirm_swap_as(p_trade_id uuid, p_actor uuid)
returns public.trade_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade public.trades;
  v_name text;
  v_item record;
  v_receiver uuid;
begin
  select * into v_trade from public.trades where id = p_trade_id for update;
  if not found or p_actor is null or p_actor not in (v_trade.sender_id, v_trade.recipient_id) then
    raise exception 'Swap not found.' using errcode = '42501';
  end if;
  if v_trade.status <> 'planning' then
    raise exception 'This swap is already %.', v_trade.status using errcode = '22023';
  end if;

  select display_name into v_name from public.profiles where id = p_actor;

  if p_actor = v_trade.sender_id and v_trade.sender_confirmed_at is null then
    update public.trades set sender_confirmed_at = now() where id = p_trade_id returning * into v_trade;
    insert into public.trade_messages (offer_id, kind, body)
    values (v_trade.offer_id, 'system', format('%s confirmed the swap.', v_name));
  elsif p_actor = v_trade.recipient_id and v_trade.recipient_confirmed_at is null then
    update public.trades set recipient_confirmed_at = now() where id = p_trade_id returning * into v_trade;
    insert into public.trade_messages (offer_id, kind, body)
    values (v_trade.offer_id, 'system', format('%s confirmed the swap.', v_name));
  end if;

  if v_trade.sender_confirmed_at is null or v_trade.recipient_confirmed_at is null then
    return v_trade.status;
  end if;

  for v_item in
    select oi.listing_id, oi.giver_id from public.offer_items oi where oi.round_id = v_trade.round_id
  loop
    v_receiver := case when v_item.giver_id = v_trade.sender_id then v_trade.recipient_id else v_trade.sender_id end;
    update public.listings
       set owner_id = v_receiver, status = 'available', for_trade = false, looking_for = null
     where id = v_item.listing_id;
    delete from public.listing_wants where listing_id = v_item.listing_id and user_id = v_receiver;
    insert into public.listing_transfers (listing_id, from_user, to_user, trade_id)
    values (v_item.listing_id, v_item.giver_id, v_receiver, p_trade_id);
  end loop;

  insert into public.trade_messages (offer_id, kind, body)
  values (v_trade.offer_id, 'system', 'Swap complete! The items are now in each other''s collections.');
  update public.profiles set trades_completed = trades_completed + 1
   where id in (v_trade.sender_id, v_trade.recipient_id);
  -- Last, so a practice trader's review (a trigger) comes after the
  -- "Swap complete!" message in the chat.
  update public.trades set status = 'completed', completed_at = now() where id = p_trade_id;

  return 'completed';
end;
$$;

create or replace function public.confirm_swap(p_trade_id uuid)
returns public.trade_status
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._confirm_swap_as(p_trade_id, auth.uid());
end;
$$;

-- Ratings now ADD to someone's history (so demo traders keep their
-- long track record when real people review them).
create or replace function public._leave_review_as(
  p_trade_id uuid, p_actor uuid, p_rating int, p_tags text[], p_comment text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_trade public.trades;
  v_reviewee uuid;
  v_id uuid;
  v_name text;
begin
  select * into v_trade from public.trades where id = p_trade_id;
  if not found or p_actor is null or p_actor not in (v_trade.sender_id, v_trade.recipient_id) then
    raise exception 'Swap not found.' using errcode = '42501';
  end if;
  if v_trade.status <> 'completed' then
    raise exception 'You can review once the swap is complete.' using errcode = '22023';
  end if;
  if exists (select 1 from public.reviews r where r.trade_id = p_trade_id and r.reviewer_id = p_actor) then
    raise exception 'You already reviewed this swap.' using errcode = '23505';
  end if;

  v_reviewee := case when p_actor = v_trade.sender_id then v_trade.recipient_id else v_trade.sender_id end;

  insert into public.reviews (trade_id, reviewer_id, reviewee_id, rating, tags, comment)
  values (p_trade_id, p_actor, v_reviewee, p_rating, coalesce(p_tags, '{}'), nullif(trim(p_comment), ''))
  returning id into v_id;

  update public.profiles
     set rating_avg = round(((coalesce(rating_avg, 0) * rating_count) + p_rating) / (rating_count + 1), 2),
         rating_count = rating_count + 1
   where id = v_reviewee;

  select display_name into v_name from public.profiles where id = p_actor;
  insert into public.trade_messages (offer_id, kind, body)
  values (v_trade.offer_id, 'system', format('%s left a review.', v_name));

  return v_id;
end;
$$;

create or replace function public.leave_review(
  p_trade_id uuid, p_rating int, p_tags text[] default '{}', p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
begin
  return public._leave_review_as(p_trade_id, auth.uid(), p_rating, p_tags, p_comment);
end;
$$;

-- The "_as" versions must never be callable by app users.
revoke execute on function public._start_offer_as(uuid, uuid[], text, uuid) from public, anon, authenticated;
revoke execute on function public._accept_offer_as(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._confirm_swap_as(uuid, uuid) from public, anon, authenticated;
revoke execute on function public._leave_review_as(uuid, uuid, int, text[], text) from public, anon, authenticated;


-- =====================================================================
-- Notifications: work out who did what from the data (not from the
-- logged-in user), so demo traders' actions are announced correctly.
-- Demo traders never receive notifications.
-- =====================================================================
create or replace function public.notify(
  p_user uuid, p_type public.notification_type, p_body text, p_link text, p_actor uuid
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, body, link, actor_id)
  select p_user, p_type, left(p_body, 200), p_link, p_actor
  where p_user is not null and p_user is distinct from p_actor and not public.is_demo(p_user)
    -- Set while we write someone's past trading history (no alerts for that).
    and coalesce(current_setting('popswap.quiet', true), '') <> 'on';
$$;

create or replace function public.notify_trade_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_proposer uuid;
  v_acceptor uuid;
begin
  select r.proposed_by into v_proposer from public.offer_rounds r where r.id = new.round_id;
  v_acceptor := case when v_proposer = new.sender_id then new.recipient_id else new.sender_id end;
  perform public.notify(v_proposer, 'offer_accepted',
    public.display_name_of(v_acceptor) || ' accepted! Head to the swap room.', '/trades/' || new.id, v_acceptor);
  return new;
end;
$$;

create or replace function public.notify_trade_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.notify(new.sender_id, 'swap_completed', 'Swap complete! Leave a review.', '/trades/' || new.id, null);
    perform public.notify(new.recipient_id, 'swap_completed', 'Swap complete! Leave a review.', '/trades/' || new.id, null);
  elsif new.status = 'planning' then
    if old.sender_confirmed_at is null and new.sender_confirmed_at is not null and new.recipient_confirmed_at is null then
      perform public.notify(new.recipient_id, 'swap_confirmed',
        public.display_name_of(new.sender_id) || ' confirmed the swap. Your turn!', '/trades/' || new.id, new.sender_id);
    elsif old.recipient_confirmed_at is null and new.recipient_confirmed_at is not null and new.sender_confirmed_at is null then
      perform public.notify(new.sender_id, 'swap_confirmed',
        public.display_name_of(new.recipient_id) || ' confirmed the swap. Your turn!', '/trades/' || new.id, new.recipient_id);
    end if;
  end if;
  return new;
end;
$$;


-- =====================================================================
-- DEMO TRADER BEHAVIOUR (all instant, inside the database)
-- Every reaction is wrapped so a demo trader can never make a real
-- person's action fail.
-- =====================================================================

-- A random friendly line of a given kind.
create or replace function public.demo_line(p_kind text)
returns text
language sql
volatile
as $$
  select lines[1 + floor(random() * array_length(lines, 1))::int]
  from (
    select case p_kind
      when 'accept' then array[
        'Deal! 🎉 I already confirmed my side. Open the swap room and tap Confirm swap to finish.',
        'Yes, that looks fair to me! I confirmed my side. Your turn in the swap room 😊',
        'Accepted! Confirm in the swap room and the items will swap.',
        'Love it, deal! I''ve confirmed. Just tap Confirm swap ✨']
      when 'chat' then array[
        'Hi! 😊 Happy to trade. If the fairness meter says Balanced, I''ll say yes right away.',
        'Good question! Everything I list is exactly as shown. Send me an offer whenever you''re ready.',
        'Tip: you can add more of your items (or ask for more of mine) to balance a trade.',
        'I''m here! Make an offer and I''ll answer instantly ✨']
      when 'swap' then array[
        'I already confirmed on my side, just tap Confirm swap above! 🙌',
        'All set from me! Confirm the swap and the items will move.',
        'Thanks for trading with me! Confirm whenever you''re ready 😊',
        'Can''t wait for you to have it! Tap Confirm swap to finish.']
      else array[
        'Super smooth swap, thank you!',
        'Friendly and fast. Would trade again!',
        'Great first trade, welcome to PopSwap!',
        'Easy to trade with. 10/10!']
    end as lines
  ) s;
$$;

create or replace function public.demo_say(p_offer_id uuid, p_bot uuid, p_body text)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.trade_messages (offer_id, sender_id, kind, body) values (p_offer_id, p_bot, 'text', p_body);
$$;

-- 1) A person sent a demo trader a proposal: accept if it's balanced (or
--    better for the demo trader); otherwise ask for a bit more.
--    "Balanced" is the same rule as the fairness meter: within 20% of
--    each other, or half a point (compareSides in src/lib/fairness.ts).
create or replace function public.demo_on_proposal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_bot uuid;
  v_human uuid := new.sender_id;
  v_give numeric;
  v_get numeric;
  v_total numeric;
  v_extra uuid[] := '{}';
  v_item record;
begin
  if new.round_id is null or v_human is null then return new; end if;
  select * into v_offer from public.offers where id = new.offer_id;
  v_bot := case when v_human = v_offer.sender_id then v_offer.recipient_id else v_offer.sender_id end;
  if not public.is_demo(v_bot) or public.is_demo(v_human) or v_offer.status <> 'pending'
     or public.is_blocked_between(v_bot, v_human) then
    return new;
  end if;

  begin
    select coalesce(sum(public.listing_points(l.rarity, l.condition)) filter (where oi.giver_id = v_bot), 0),
           coalesce(sum(public.listing_points(l.rarity, l.condition)) filter (where oi.giver_id <> v_bot), 0)
      into v_give, v_get
    from public.offer_items oi join public.listings l on l.id = oi.listing_id
    where oi.round_id = new.round_id;

    if v_get >= v_give - greatest(0.5, 0.2 * greatest(v_give, v_get)) then
      perform public._accept_offer_as(new.offer_id, v_bot);
      perform public.demo_say(new.offer_id, v_bot, public.demo_line('accept'));
    else
      -- Ask for the person's cheapest other items until it's fair (up to 3).
      v_total := v_get;
      for v_item in
        select l.id, public.listing_points(l.rarity, l.condition) as pts
        from public.listings l
        where l.owner_id = v_human and l.status = 'available' and l.for_trade
          and l.id not in (select oi.listing_id from public.offer_items oi where oi.round_id = new.round_id)
        order by 2 asc
      loop
        exit when v_total >= v_give - greatest(0.5, 0.2 * greatest(v_give, v_total))
               or coalesce(array_length(v_extra, 1), 0) >= 3;
        v_extra := v_extra || v_item.id;
        v_total := v_total + v_item.pts;
      end loop;

      if v_total >= v_give - greatest(0.5, 0.2 * greatest(v_give, v_total))
         and coalesce(array_length(v_extra, 1), 0) > 0 then
        perform public.create_offer_round(
          new.offer_id, v_bot,
          (select array_agg(oi.listing_id) from public.offer_items oi where oi.round_id = new.round_id) || v_extra,
          format('That''s a little uneven for me (I''d give %s points and get %s), so I added %s more of your items to balance it. Accept if that works! 🙂',
                 v_give, v_get, array_length(v_extra, 1)));
      else
        perform public.demo_say(new.offer_id, v_bot,
          format('Thanks for the offer! It''s uneven for me though: I''d give %s points and get %s. Could you add another item, or pick a different one of mine? 🙂',
                 v_give, v_get));
      end if;
    end if;
  exception when others then
    raise warning 'Demo trader could not respond: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trade_messages_demo_proposal
  after insert on public.trade_messages
  for each row when (new.kind = 'proposal')
  execute function public.demo_on_proposal();

-- 2) A person wrote in a trade chat with a demo trader: chat back.
create or replace function public.demo_on_trade_text()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_bot uuid;
begin
  if new.sender_id is null or public.is_demo(new.sender_id) then return new; end if;
  select * into v_offer from public.offers where id = new.offer_id;
  v_bot := case when new.sender_id = v_offer.sender_id then v_offer.recipient_id else v_offer.sender_id end;
  if not public.is_demo(v_bot) or v_offer.status not in ('pending', 'accepted')
     or public.is_blocked_between(v_bot, new.sender_id) then
    return new;
  end if;
  begin
    perform public.demo_say(new.offer_id, v_bot,
      public.demo_line(case when v_offer.status = 'accepted' then 'swap' else 'chat' end));
  exception when others then
    raise warning 'Demo trader could not reply: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trade_messages_demo_text
  after insert on public.trade_messages
  for each row when (new.kind = 'text')
  execute function public.demo_on_trade_text();

-- 3) Direct messages to a demo trader get a reply too.
create or replace function public.demo_on_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.direct_threads;
  v_bot uuid;
begin
  if public.is_demo(new.sender_id) then return new; end if;
  select * into v_thread from public.direct_threads where id = new.thread_id;
  v_bot := case when new.sender_id = v_thread.user_a then v_thread.user_b else v_thread.user_a end;
  if not public.is_demo(v_bot) or public.is_blocked_between(v_bot, new.sender_id) then return new; end if;
  begin
    insert into public.direct_messages (thread_id, sender_id, body)
    values (new.thread_id, v_bot, public.demo_line('chat'));
  exception when others then
    raise warning 'Demo trader could not reply: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger direct_messages_demo_reply
  after insert on public.direct_messages
  for each row execute function public.demo_on_direct_message();

-- 4) A new swap with a demo trader: they confirm their side right away.
create or replace function public.demo_on_trade_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'planning' or (public.is_demo(new.sender_id) and public.is_demo(new.recipient_id)) then
    return new;
  end if;
  begin
    if public.is_demo(new.sender_id) then perform public._confirm_swap_as(new.id, new.sender_id); end if;
    if public.is_demo(new.recipient_id) then perform public._confirm_swap_as(new.id, new.recipient_id); end if;
    -- A person accepted the demo trader's proposal: say thanks. (When the
    -- demo trader is the one accepting, demo_on_proposal already spoke.)
    if public.is_demo((select r.proposed_by from public.offer_rounds r where r.id = new.round_id)) then
      perform public.demo_say(new.offer_id,
        (select r.proposed_by from public.offer_rounds r where r.id = new.round_id), public.demo_line('swap'));
    end if;
  exception when others then
    raise warning 'Demo trader could not confirm: %', sqlerrm;
  end;
  return new;
end;
$$;

create trigger trades_zz_demo_confirm
  after insert on public.trades
  for each row execute function public.demo_on_trade_created();

-- 5) A swap with a demo trader completed: they review you, and put what
--    they received back up for trade (so they never run out of items).
create or replace function public.demo_on_trade_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bot uuid;
begin
  foreach v_bot in array array[new.sender_id, new.recipient_id] loop
    if public.is_demo(v_bot) and not (public.is_demo(new.sender_id) and public.is_demo(new.recipient_id)) then
      begin
        perform public._leave_review_as(
          new.id, v_bot, 5,
          case floor(random() * 3)::int
            when 0 then array['good_trade', 'trustworthy']
            when 1 then array['flexible', 'good_trade']
            else array['as_described', 'trustworthy']
          end,
          public.demo_line('review'));
        update public.listings
           set for_trade = true,
               looking_for = (select ci.series from public.catalog_items ci order by random() limit 1)
         where owner_id = v_bot
           and id in (select oi.listing_id from public.offer_items oi where oi.round_id = new.round_id);
      exception when others then
        raise warning 'Demo trader could not finish up: %', sqlerrm;
      end;
    end if;
  end loop;
  return new;
end;
$$;

create trigger trades_zz_demo_completed
  after update on public.trades
  for each row when (old.status is distinct from new.status and new.status = 'completed')
  execute function public.demo_on_trade_completed();

revoke execute on function public.demo_say(uuid, uuid, text) from public, anon, authenticated;


-- =====================================================================
-- Starter packs now come with a WELCOME OFFER from a demo trader, so a
-- solo tester has a trade to try straight away.
-- =====================================================================
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
  v_mine public.listings;
  v_bot_item public.listings;
  v_pick uuid;
  v_name text;
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

  -- Your trader level: about 1 in 3 people start as an Experienced trader
  -- with a short trading history. Everyone else starts as a New trader.
  if random() < 0.35 then
    begin
      perform public._give_trading_history(v_user, p_community_id);
    exception when others then
      raise warning 'Trading history skipped: %', sqlerrm;
    end;
  end if;

  -- Welcome offer: a demo trader offers an item worth about the same as
  -- one of yours (one from your collecting goal if they have it).
  begin
    -- Roll the dice ONCE (inside a WHERE it would be re-rolled per row).
    v_pick := v_ids[1 + floor(random() * 4)::int];
    select * into v_mine from public.listings where id = v_pick;
    select l.* into v_bot_item
    from public.listings l join public.profiles p on p.id = l.owner_id
    where p.is_demo and l.status = 'available' and l.for_trade
    order by (l.title like '% · ' || v_goal) desc,
             abs(public.listing_points(l.rarity, l.condition) - public.listing_points(v_mine.rarity, v_mine.condition)),
             random()
    limit 1;
    if found then
      select display_name into v_name from public.profiles where id = v_user;
      perform public._start_offer_as(
        v_mine.id, array[v_bot_item.id],
        format('Hi %s, welcome to PopSwap! 🎉 I love your %s. Would you trade it for my %s? Tap Accept to try your first swap!',
               v_name, split_part(v_mine.title, ' · ', 1), split_part(v_bot_item.title, ' · ', 1)),
        v_bot_item.owner_id);
    end if;
  exception when others then
    raise warning 'Welcome offer skipped: %', sqlerrm;
  end;

  return v_ids;
end;
$$;


-- =====================================================================
-- Seeding helpers (used by seed.sql and the host's "add demo" button)
-- =====================================================================

-- A virtual trinket listing for someone.
create or replace function public._demo_listing(
  p_owner uuid, p_community uuid, p_rarity public.listing_rarity, p_for_trade boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.catalog_items;
  v_id uuid;
begin
  select * into v_item from public.catalog_items ci where ci.rarity = p_rarity order by random() limit 1;
  if not found then return null; end if;
  insert into public.listings
    (owner_id, community_id, title, description, condition, rarity, for_trade, looking_for, catalog_item_id)
  values (
    p_owner, p_community, v_item.name || ' · ' || v_item.series,
    v_item.blurb || ' (' || v_item.form || ', virtual trinket.)',
    (array['sealed', 'like_new', 'like_new', 'gently_used'])[1 + floor(random() * 4)::int]::public.listing_condition,
    v_item.rarity, p_for_trade,
    case when p_for_trade then (select ci.series from public.catalog_items ci order by random() limit 1) end,
    v_item.id
  )
  returning id into v_id;
  insert into public.listing_images (listing_id, path, position) values (v_id, v_item.image_path, 0);
  return v_id;
end;
$$;
revoke execute on function public._demo_listing(uuid, uuid, public.listing_rarity, boolean) from public, anon, authenticated;

-- The 10 demo traders, their items, and 12 example trades that already
-- happened (with chats, journeys and reviews). Safe to run again.
create or replace function public.seed_demo_history()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bb uuid := (select id from public.communities where slug = 'blind-boxes');
  v_bots uuid[];
  v_bot uuid;
  v_r public.listing_rarity;
  v_pairs int[] := array[1,2, 3,4, 5,6, 7,8, 9,10, 1,3, 2,9, 4,10, 6,7, 8,5, 1,6, 3,9];
  v_rar text[] := array['uncommon','uncommon', 'common','common', 'rare','rare', 'common','uncommon',
                        'uncommon','common', 'secret','rare', 'rare','uncommon', 'common','common',
                        'uncommon','uncommon', 'rare','uncommon', 'common','common', 'uncommon','rare'];
  v_a uuid; v_b uuid;
begin
  if v_bb is null or not exists (select 1 from public.catalog_items) then return; end if;

  insert into public.profiles
    (id, username, display_name, avatar_path, bio, location, trades_completed, rating_count, rating_avg, is_demo, starter_pack_claimed_at)
  values
    ('d0000000-0000-4000-8000-000000000001', 'mochi_trades', 'Mochi', '/avatars/1.svg', 'Blind box addict. I''ll trade almost anything for a Secret!', 'UC San Diego', 34, 31, 4.90, true, now()),
    ('d0000000-0000-4000-8000-000000000002', 'kai_pins', 'Kai', '/avatars/6.svg', 'Pin board almost full. Hunting Cosmic Cats.', 'UC San Diego', 21, 19, 4.80, true, now()),
    ('d0000000-0000-4000-8000-000000000003', 'luna_collects', 'Luna', '/avatars/2.svg', 'Collecting Dreamy Bunnies since day one.', 'UCLA', 18, 18, 5.00, true, now()),
    ('d0000000-0000-4000-8000-000000000004', 'bao_bear', 'Bao', '/avatars/8.svg', 'Snack Bears are life. Fast, friendly trades.', 'UC San Diego', 27, 24, 4.70, true, now()),
    ('d0000000-0000-4000-8000-000000000005', 'juniper_frogs', 'Juniper', '/avatars/3.svg', 'Frog keychains on every bag I own.', 'UC Irvine', 12, 11, 4.90, true, now()),
    ('d0000000-0000-4000-8000-000000000006', 'pixel_ghost', 'Pixel', '/avatars/10.svg', 'Trading cards and ghosts. Always down to swap.', 'UC San Diego', 40, 37, 4.80, true, now()),
    ('d0000000-0000-4000-8000-000000000007', 'sunny_side', 'Sunny', '/avatars/4.svg', 'Newish collector and super friendly!', 'San Diego', 9, 9, 5.00, true, now()),
    ('d0000000-0000-4000-8000-000000000008', 'rory_sealed', 'Rory', '/avatars/7.svg', 'I keep everything sealed and my photos honest.', 'UC Santa Barbara', 15, 14, 4.90, true, now()),
    ('d0000000-0000-4000-8000-000000000009', 'nova_space', 'Nova', '/avatars/5.svg', 'Space-themed everything. Cosmic Cats please!', 'UC San Diego', 23, 21, 4.80, true, now()),
    ('d0000000-0000-4000-8000-000000000010', 'tofu_plush', 'Tofu', '/avatars/9.svg', 'Plush collector. Snack Bears welcome.', 'UC Berkeley', 30, 28, 4.90, true, now())
  on conflict (id) do nothing;
  update public.profiles set trader_level = 'experienced' where is_demo and trader_level <> 'experienced';

  v_bots := array(select id from public.profiles where is_demo order by id);
  insert into public.community_members (community_id, user_id)
  select v_bb, b from unnest(v_bots) b on conflict do nothing;

  -- Their items (first run only): 6 to trade (+ a Secret for two of them), 2 showcase.
  if not exists (select 1 from public.listings l join public.profiles p on p.id = l.owner_id where p.is_demo) then
    foreach v_bot in array v_bots loop
      foreach v_r in array array['common','common','common','uncommon','uncommon','rare']::public.listing_rarity[] loop
        perform public._demo_listing(v_bot, v_bb, v_r, true);
      end loop;
      perform public._demo_listing(v_bot, v_bb, 'rare', false);
      perform public._demo_listing(v_bot, v_bb, 'uncommon', false);
    end loop;
    perform public._demo_listing(v_bots[1], v_bb, 'secret', true);
    perform public._demo_listing(v_bots[6], v_bb, 'secret', true);
  end if;

  -- Example trades that already happened (first run only).
  if exists (select 1 from public.trades t join public.profiles p on p.id = t.sender_id where p.is_demo) then
    return;
  end if;

  for i in 1 .. 12 loop
    v_a := v_bots[v_pairs[i * 2 - 1]];
    v_b := v_bots[v_pairs[i * 2]];
    perform public._record_past_swap(
      v_a, public._demo_listing(v_a, v_bb, v_rar[i * 2 - 1]::public.listing_rarity, true),
      v_b, public._demo_listing(v_b, v_bb, v_rar[i * 2]::public.listing_rarity, true),
      now() - ((13 - i) * interval '17 hours'), true);
  end loop;
end;
$$;
revoke execute on function public.seed_demo_history() from public, anon, authenticated;

-- Writes down a swap that ALREADY happened (chat, swap, item journey and
-- reviews): A proposed and gave p_la, B gave p_lb. A always reviews B;
-- B reviews A only if p_both_review. Used for the example trades and for
-- Experienced traders' history.
create or replace function public._record_past_swap(
  p_a uuid, p_la uuid, p_b uuid, p_lb uuid, p_when timestamptz, p_both_review boolean
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer uuid;
  v_round uuid;
  v_trade uuid;
  v_ta text;
  v_tb text;
begin
  if p_la is null or p_lb is null then return null; end if;
  select split_part(title, ' · ', 1) into v_ta from public.listings where id = p_la;
  select split_part(title, ' · ', 1) into v_tb from public.listings where id = p_lb;

  insert into public.offers (listing_id, sender_id, recipient_id, status, created_at, updated_at)
  values (p_lb, p_a, p_b, 'accepted', p_when, p_when) returning id into v_offer;
  insert into public.offer_rounds (offer_id, round_no, proposed_by, created_at)
  values (v_offer, 1, p_a, p_when) returning id into v_round;
  update public.offers set current_round_id = v_round where id = v_offer;
  insert into public.offer_items (round_id, listing_id, giver_id) values (v_round, p_la, p_a), (v_round, p_lb, p_b);

  insert into public.trade_messages (offer_id, sender_id, kind, body, round_id, created_at) values
    (v_offer, p_a, 'proposal', format('Hi! Would you swap your %s for my %s?', v_tb, v_ta), v_round, p_when),
    (v_offer, p_b, 'text', 'Ooh yes, I''ve been looking for that one! Deal 🙌', null, p_when + interval '8 minutes'),
    (v_offer, null, 'system', 'Offer accepted! The items are locked while you get ready to swap.', null, p_when + interval '9 minutes'),
    (v_offer, null, 'system', 'Swap complete! The items are now in each other''s collections.', null, p_when + interval '2 hours');

  insert into public.trades
    (offer_id, round_id, sender_id, recipient_id, status, sender_confirmed_at, recipient_confirmed_at, completed_at, created_at)
  values (v_offer, v_round, p_a, p_b, 'completed', p_when + interval '1 hour', p_when + interval '2 hours',
          p_when + interval '2 hours', p_when + interval '9 minutes')
  returning id into v_trade;

  update public.listings set owner_id = p_b, for_trade = false, looking_for = null where id = p_la;
  update public.listings set owner_id = p_a, for_trade = false, looking_for = null where id = p_lb;
  insert into public.listing_transfers (listing_id, from_user, to_user, trade_id, created_at) values
    (p_la, p_a, p_b, v_trade, p_when + interval '2 hours'),
    (p_lb, p_b, p_a, v_trade, p_when + interval '2 hours');

  insert into public.reviews (trade_id, reviewer_id, reviewee_id, rating, tags, comment, created_at)
  values (v_trade, p_a, p_b, 5, array['good_trade', 'trustworthy'],
          format('Smooth swap! The %s is perfect.', v_tb), p_when + interval '3 hours');
  if p_both_review then
    insert into public.reviews (trade_id, reviewer_id, reviewee_id, rating, tags, comment, created_at)
    values (v_trade, p_b, p_a, (array[4, 5, 5])[1 + floor(random() * 3)::int], array['as_described', 'flexible'],
            format('Fast and friendly. Love my new %s!', v_ta), p_when + interval '4 hours');
  end if;
  return v_trade;
end;
$$;
revoke execute on function public._record_past_swap(uuid, uuid, uuid, uuid, timestamptz, boolean)
  from public, anon, authenticated;

-- Makes someone an EXPERIENCED trader: 2 swaps they already did with
-- demo traders (with reviews and item journeys they can look at), a
-- longer record from before (trade count and rating), and a fitting bio.
create or replace function public._give_trading_history(p_user uuid, p_community uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bots uuid[] := array(select id from public.profiles where is_demo order by random() limit 2);
  v_earlier int := 4 + floor(random() * 11)::int;  -- 4 to 14 trades before these two
  v_mine uuid;
  v_given uuid[] := '{}';
begin
  if coalesce(array_length(v_bots, 1), 0) < 2 then return; end if;

  perform set_config('popswap.quiet', 'on', true);  -- no notifications for the past
  for i in 1 .. 2 loop
    v_mine := public._demo_listing(p_user, p_community, (array['common', 'uncommon'])[i]::public.listing_rarity, true);
    perform public._record_past_swap(
      v_bots[i], public._demo_listing(v_bots[i], p_community, (array['uncommon', 'common'])[i]::public.listing_rarity, true),
      p_user, v_mine,
      now() - ((i * 3 + floor(random() * 3)::int) * interval '1 day'), false);
    v_given := v_given || v_mine;
  end loop;
  perform set_config('popswap.quiet', 'off', true);

  -- The demo traders put what they got from you back up for trade.
  update public.listings
     set for_trade = true, looking_for = (select ci.series from public.catalog_items ci order by random() limit 1)
   where id = any (v_given);

  update public.profiles
     set trader_level = 'experienced',
         trades_completed = trades_completed + 2 + v_earlier,
         rating_count = 2 + v_earlier - floor(random() * 3)::int,
         rating_avg = round((4.6 + random() * 0.4)::numeric, 1),
         bio = case when bio is null or bio = 'New to PopSwap and ready to trade!'
                    then 'Experienced trader. Fair swaps and fast replies! ✨' else bio end
   where id = p_user;
end;
$$;
revoke execute on function public._give_trading_history(uuid, uuid) from public, anon, authenticated;


-- =====================================================================
-- "Your next step" on the Home page: the facts it needs, in one call.
-- =====================================================================
create or replace function public.my_next_steps()
returns table (
  has_pack boolean,
  trader_level text,
  answer_offer_id uuid,     -- an offer waiting for YOUR answer
  answer_from text,         -- ...from this person
  confirm_trade_id uuid,    -- a swap waiting for YOUR confirmation
  review_trade_id uuid,     -- a finished swap you haven't reviewed
  swaps_done int,           -- swaps you finished on PopSwap (not past history)
  real_swaps int,           -- ...of those, swaps with a real person (not a demo trader)
  reviews_written int,
  offers_made int,          -- negotiations you started
  joined_event boolean,     -- entered, voted in or RSVP'd to any event
  live_event_id uuid,       -- a live event in one of your rooms
  live_event_title text,
  room_slug text            -- your newest room
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_user;
  if not found then return; end if;

  has_pack := v_profile.starter_pack_claimed_at is not null;
  trader_level := v_profile.trader_level;

  select o.id, public.display_name_of(case when o.sender_id = v_user then o.recipient_id else o.sender_id end)
    into answer_offer_id, answer_from
  from public.offers o join public.offer_rounds r on r.id = o.current_round_id
  where o.status = 'pending' and v_user in (o.sender_id, o.recipient_id) and r.proposed_by <> v_user
  order by o.updated_at desc
  limit 1;

  select t.id into confirm_trade_id
  from public.trades t
  where t.status = 'planning'
    and ((t.sender_id = v_user and t.sender_confirmed_at is null)
      or (t.recipient_id = v_user and t.recipient_confirmed_at is null))
  order by t.created_at desc
  limit 1;

  select t.id into review_trade_id
  from public.trades t
  where t.status = 'completed' and v_user in (t.sender_id, t.recipient_id)
    and t.completed_at >= v_profile.created_at
    and not exists (select 1 from public.reviews r where r.trade_id = t.id and r.reviewer_id = v_user)
  order by t.completed_at desc
  limit 1;

  select count(*)::int,
         (count(*) filter (where not public.is_demo(case when t.sender_id = v_user then t.recipient_id else t.sender_id end)))::int
    into swaps_done, real_swaps
  from public.trades t
  where t.status = 'completed' and v_user in (t.sender_id, t.recipient_id)
    and t.completed_at >= v_profile.created_at;

  select count(*)::int into reviews_written from public.reviews r where r.reviewer_id = v_user;
  select count(*)::int into offers_made from public.offers o where o.sender_id = v_user;

  joined_event := exists (select 1 from public.event_rsvps x where x.user_id = v_user)
               or exists (select 1 from public.event_entries x where x.user_id = v_user)
               or exists (select 1 from public.event_votes x where x.voter_id = v_user);

  select e.id, e.title into live_event_id, live_event_title
  from public.events e
  join public.community_members m on m.community_id = e.community_id and m.user_id = v_user
  where e.status = 'live'
  order by (e.type = 'swap_meet') desc, e.starts_at desc
  limit 1;

  select c.slug into room_slug
  from public.community_members m join public.communities c on c.id = m.community_id
  where m.user_id = v_user
  order by m.joined_at desc
  limit 1;

  return next;
end;
$$;
revoke execute on function public.my_next_steps() from public, anon;
grant execute on function public.my_next_steps() to authenticated;


-- =====================================================================
-- Recent swaps feed: finished trades anyone can look at (who swapped
-- what, and how they rated it). Optionally just one room.
-- =====================================================================
create or replace function public.recent_swaps(p_community_id uuid default null, p_limit int default 8)
returns table (
  trade_id uuid,
  completed_at timestamptz,
  a_username text, a_name text, a_avatar text,
  a_item_id uuid, a_item_title text, a_item_image text, a_items int,
  b_username text, b_name text, b_avatar text,
  b_item_id uuid, b_item_title text, b_item_image text, b_items int,
  stars numeric
)
language sql
stable
security definer
set search_path = ''
as $$
  select t.id, t.completed_at,
         pa.username, pa.display_name, pa.avatar_path,
         ia.listing_id, ia.title, ia.image, ia.n,
         pb.username, pb.display_name, pb.avatar_path,
         ib.listing_id, ib.title, ib.image, ib.n,
         (select round(avg(r.rating), 1) from public.reviews r where r.trade_id = t.id)
  from public.trades t
  join public.offers o on o.id = t.offer_id
  join public.listings ol on ol.id = o.listing_id
  join public.profiles pa on pa.id = t.sender_id
  join public.profiles pb on pb.id = t.recipient_id
  cross join lateral (
    select oi.listing_id, split_part(l.title, ' · ', 1) as title,
           (select li.path from public.listing_images li where li.listing_id = l.id order by li.position limit 1) as image,
           (count(*) over ())::int as n
    from public.offer_items oi join public.listings l on l.id = oi.listing_id
    where oi.round_id = t.round_id and oi.giver_id = t.sender_id
    order by l.title
    limit 1
  ) ia
  cross join lateral (
    select oi.listing_id, split_part(l.title, ' · ', 1) as title,
           (select li.path from public.listing_images li where li.listing_id = l.id order by li.position limit 1) as image,
           (count(*) over ())::int as n
    from public.offer_items oi join public.listings l on l.id = oi.listing_id
    where oi.round_id = t.round_id and oi.giver_id = t.recipient_id
    order by l.title
    limit 1
  ) ib
  where t.status = 'completed'
    and (p_community_id is null or ol.community_id = p_community_id)
  order by t.completed_at desc
  limit least(greatest(coalesce(p_limit, 8), 1), 30);
$$;
revoke execute on function public.recent_swaps(uuid, int) from public, anon;
grant execute on function public.recent_swaps(uuid, int) to authenticated;

-- Demo traders join a room, list a few items there, and liven it up
-- with events happening RIGHT NOW: a live Swap Meet, a live Showcase
-- Contest, and a Mystery Swap starting soon. Safe to call again.
create or replace function public.add_demo_activity(p_community_id uuid)
returns int
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bots uuid[];
  v_event uuid;
  v_listing uuid;
  v_entries uuid[] := '{}';
  v_entry uuid;
  v_created int := 0;
begin
  if auth.uid() is not null and not public.is_member(p_community_id) then
    raise exception 'Join the community first.' using errcode = '42501';
  end if;
  v_bots := array(select id from public.profiles where is_demo order by random());
  if coalesce(array_length(v_bots, 1), 0) < 6 then
    raise exception 'Demo traders aren''t set up yet (run seed.sql).' using errcode = 'P0002';
  end if;

  insert into public.community_members (community_id, user_id)
  select p_community_id, b from unnest(v_bots) b on conflict do nothing;

  -- Make sure several demo traders have items to trade in this room.
  for i in 1 .. 6 loop
    if not exists (
      select 1 from public.listings l
      where l.owner_id = v_bots[i] and l.community_id = p_community_id and l.status = 'available' and l.for_trade
    ) then
      perform public._demo_listing(v_bots[i], p_community_id, 'common', true);
      perform public._demo_listing(v_bots[i], p_community_id, 'uncommon', true);
      perform public._demo_listing(v_bots[i], p_community_id, (case when i <= 2 then 'rare' else 'common' end)::public.listing_rarity, true);
    end if;
  end loop;

  -- Live Swap Meet with demo items on the table.
  if not exists (
    select 1 from public.events e
    where e.community_id = p_community_id and e.type = 'swap_meet' and e.status = 'live' and e.created_by is null
  ) then
    insert into public.events (community_id, type, title, description, starts_at, status, mini_activity)
    values (p_community_id, 'swap_meet', 'Live Swap Meet',
            'Happening right now! Demo traders already put items on the table. Bring yours and make offers.',
            now(), 'live', 'Trade Bingo: try a 1-for-1, a 2-for-1, and a trade for a Rare.')
    returning id into v_event;
    insert into public.event_entries (event_id, user_id, listing_id)
    select v_event, x.owner_id, x.id
    from (
      select distinct on (l.owner_id) l.owner_id, l.id
      from public.listings l join public.profiles p on p.id = l.owner_id
      where p.is_demo and l.community_id = p_community_id and l.status = 'available' and l.for_trade
      order by l.owner_id, random()
    ) x
    limit 6;
    insert into public.event_rsvps (event_id, user_id) select v_event, b from unnest(v_bots[1:6]) b on conflict do nothing;
    v_created := v_created + 1;
  end if;

  -- Live Showcase Contest with demo entries and votes.
  if not exists (
    select 1 from public.events e
    where e.community_id = p_community_id and e.type = 'showcase_contest' and e.status = 'live' and e.created_by is null
  ) then
    insert into public.events (community_id, type, title, description, theme, starts_at, status, mini_activity)
    values (p_community_id, 'showcase_contest', 'Live Showcase Contest',
            'Voting is open now! Pick your favourite, or enter one of your own items.',
            'Best trinket', now(), 'live', 'One vote each. The host ends it and crowns the winner.')
    returning id into v_event;
    for i in 1 .. 4 loop
      v_listing := public._demo_listing(v_bots[i], p_community_id,
                                        (array['rare', 'uncommon', 'secret', 'rare'])[i]::public.listing_rarity, false);
      insert into public.event_entries (event_id, user_id, listing_id, caption)
      values (v_event, v_bots[i], v_listing,
              (array['My pride and joy ✨', 'Look at that shine!', 'Finally pulled the secret!', 'Desk buddy forever'])[i])
      returning id into v_entry;
      v_entries := v_entries || v_entry;
    end loop;
    for i in 5 .. array_length(v_bots, 1) loop
      insert into public.event_votes (entry_id, event_id, voter_id)
      values (v_entries[1 + floor(random() * 4)::int], v_event, v_bots[i]);
    end loop;
    v_created := v_created + 1;
  end if;

  -- Mystery Swap starting soon, with 3 demo items already in the pool.
  if not exists (
    select 1 from public.events e
    where e.community_id = p_community_id and e.type = 'mystery_swap' and e.status <> 'ended' and e.created_by is null
      and e.title = 'Mystery Swap'
  ) then
    insert into public.events (community_id, type, title, description, starts_at, status, mini_activity)
    values (p_community_id, 'mystery_swap', 'Mystery Swap',
            'Put one item in the pool. When the host shuffles, everyone gets a surprise from someone else!',
            now() + interval '30 minutes', 'upcoming', 'Leave a note for whoever gets your item.')
    returning id into v_event;
    for i in 7 .. 9 loop
      select l.id into v_listing from public.listings l
      where l.owner_id = v_bots[i] and l.status = 'available' and l.for_trade order by random() limit 1;
      if v_listing is not null then
        insert into public.event_entries (event_id, user_id, listing_id, caption)
        values (v_event, v_bots[i], v_listing, 'Enjoy your surprise! 🎁');
        update public.listings set status = 'pending' where id = v_listing;
      end if;
    end loop;
    v_created := v_created + 1;
  end if;

  return v_created;
end;
$$;
revoke execute on function public.add_demo_activity(uuid) from public, anon;
grant execute on function public.add_demo_activity(uuid) to authenticated;
