-- =====================================================================
-- 0008_notifications_safety.sql
-- The notification bell (created automatically by triggers) and safety
-- basics: report a listing or person, and block people.
-- Run after 0007_chat.sql.
-- =====================================================================

create type public.notification_type as enum (
  'new_offer', 'counter_offer', 'offer_accepted', 'offer_declined',
  'trade_message', 'direct_message', 'swap_confirmed', 'swap_completed', 'new_review', 'new_friend'
);

create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  type       public.notification_type not null,
  body       text not null,
  link       text not null,               -- where tapping it takes you, e.g. "/offers/<id>"
  actor_id   uuid references public.profiles (id) on delete set null,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);

alter table public.notifications enable row level security;
create policy "Users can view their notifications"
  on public.notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Users can mark their notifications read"
  on public.notifications for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Users can clear their notifications"
  on public.notifications for delete to authenticated
  using (user_id = (select auth.uid()));
revoke update on public.notifications from anon, authenticated;
grant update (read_at) on public.notifications to authenticated;

-- Helper used by the triggers below.
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
  where p_user is not null and p_user is distinct from p_actor;
$$;
revoke execute on function public.notify(uuid, public.notification_type, text, text, uuid) from public, anon, authenticated;

create or replace function public.display_name_of(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select display_name from public.profiles where id = p_user), 'Someone');
$$;


-- ---------------------------------------------------------------------
-- Triggers that create notifications
-- ---------------------------------------------------------------------

-- Trade chat: proposals ("new offer" / "counter-offer") and text messages.
create or replace function public.notify_trade_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offer public.offers;
  v_other uuid;
  v_round int;
begin
  if new.sender_id is null then return new; end if;   -- system messages
  select * into v_offer from public.offers where id = new.offer_id;
  v_other := case when new.sender_id = v_offer.sender_id then v_offer.recipient_id else v_offer.sender_id end;

  if new.kind = 'proposal' then
    select r.round_no into v_round from public.offer_rounds r where r.id = new.round_id;
    perform public.notify(
      v_other,
      (case when v_round = 1 then 'new_offer' else 'counter_offer' end)::public.notification_type,
      public.display_name_of(new.sender_id) || case when v_round = 1 then ' made you an offer' else ' sent a counter-offer' end,
      '/offers/' || new.offer_id, new.sender_id);
  elsif new.kind = 'text' then
    -- One unread "new message" per conversation is enough.
    if not exists (
      select 1 from public.notifications n
      where n.user_id = v_other and n.type = 'trade_message' and n.link = '/offers/' || new.offer_id and n.read_at is null
    ) then
      perform public.notify(v_other, 'trade_message',
        public.display_name_of(new.sender_id) || ': ' || new.body, '/offers/' || new.offer_id, new.sender_id);
    end if;
  end if;
  return new;
end;
$$;
create trigger trade_messages_notify after insert on public.trade_messages
  for each row execute function public.notify_trade_message();

-- Offer declined, or closed automatically (an item went to another trade).
-- ("Accepted" is announced when the trade is created, further down.)
create or replace function public.notify_offer_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then return new; end if;
  if new.closed_reason = 'Declined.' then
    perform public.notify(new.sender_id, 'offer_declined',
      public.display_name_of(new.recipient_id) || ' declined your offer', '/offers/' || new.id, new.recipient_id);
  else
    perform public.notify(new.sender_id, 'offer_declined',
      'Your offer was closed: ' || coalesce(new.closed_reason, 'no longer available'), '/offers/' || new.id, null);
  end if;
  return new;
end;
$$;
create trigger offers_notify_status after update of status on public.offers
  for each row when (new.status = 'declined')
  execute function public.notify_offer_status();

create or replace function public.notify_trade_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid := case when auth.uid() = new.sender_id then new.recipient_id else new.sender_id end;
begin
  perform public.notify(v_target, 'offer_accepted',
    public.display_name_of(v_actor) || ' accepted! Head to the swap room.', '/trades/' || new.id, v_actor);
  return new;
end;
$$;
create trigger trades_notify_created after insert on public.trades
  for each row execute function public.notify_trade_created();

-- Swap confirmations and completion.
create or replace function public.notify_trade_progress()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_target uuid := case when auth.uid() = new.sender_id then new.recipient_id else new.sender_id end;
begin
  if new.status = 'completed' and old.status <> 'completed' then
    perform public.notify(new.sender_id, 'swap_completed', 'Swap complete! Leave a review.', '/trades/' || new.id, null);
    perform public.notify(new.recipient_id, 'swap_completed', 'Swap complete! Leave a review.', '/trades/' || new.id, null);
  elsif (old.sender_confirmed_at is null and new.sender_confirmed_at is not null)
     or (old.recipient_confirmed_at is null and new.recipient_confirmed_at is not null) then
    -- Only when exactly ONE person has confirmed (the second confirmation
    -- completes the swap, which has its own notification).
    if new.status = 'planning' and ((new.sender_confirmed_at is null) <> (new.recipient_confirmed_at is null)) then
      perform public.notify(v_target, 'swap_confirmed',
        public.display_name_of(v_actor) || ' confirmed the swap. Your turn!', '/trades/' || new.id, v_actor);
    end if;
  end if;
  return new;
end;
$$;
create trigger trades_notify_progress after update on public.trades
  for each row execute function public.notify_trade_progress();

-- New review.
create or replace function public.notify_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify(new.reviewee_id, 'new_review',
    public.display_name_of(new.reviewer_id) || ' left you a ' || new.rating || '-star review',
    '/u/' || (select username from public.profiles where id = new.reviewee_id) || '?tab=reviews', new.reviewer_id);
  return new;
end;
$$;
create trigger reviews_notify after insert on public.reviews
  for each row execute function public.notify_review();

-- Direct messages (one unread notification per conversation).
create or replace function public.notify_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_thread public.direct_threads;
  v_other uuid;
begin
  select * into v_thread from public.direct_threads where id = new.thread_id;
  v_other := case when new.sender_id = v_thread.user_a then v_thread.user_b else v_thread.user_a end;
  if not exists (
    select 1 from public.notifications n
    where n.user_id = v_other and n.type = 'direct_message' and n.link = '/chats/' || new.thread_id and n.read_at is null
  ) then
    perform public.notify(v_other, 'direct_message',
      public.display_name_of(new.sender_id) || ': ' || new.body, '/chats/' || new.thread_id, new.sender_id);
  end if;
  return new;
end;
$$;
create trigger direct_messages_notify after insert on public.direct_messages
  for each row execute function public.notify_direct_message();

-- Someone added you as a friend.
create or replace function public.notify_friend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.notify(new.friend_id, 'new_friend',
    public.display_name_of(new.user_id) || ' added you as a friend',
    '/u/' || (select username from public.profiles where id = new.user_id), new.user_id);
  return new;
end;
$$;
create trigger friends_notify after insert on public.friends
  for each row execute function public.notify_friend();

alter publication supabase_realtime add table public.notifications;


-- =====================================================================
-- SAFETY: reports and blocks
-- =====================================================================
create table public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles (id) on delete cascade,
  reported_user_id uuid references public.profiles (id) on delete cascade,
  listing_id       uuid references public.listings (id) on delete set null,
  reason           text not null check (char_length(reason) between 3 and 500),
  created_at       timestamptz not null default now(),
  check (reported_user_id is not null or listing_id is not null)
);

alter table public.reports enable row level security;
-- You can file reports and see your own; nobody can read others' reports
-- through the app (there's no admin panel yet: use the Supabase dashboard).
create policy "Users can file reports"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy "Users can see their own reports"
  on public.reports for select to authenticated
  using (reporter_id = (select auth.uid()));

create table public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

alter table public.blocks enable row level security;
create policy "Users can see their blocks"
  on public.blocks for select to authenticated
  using (blocker_id = (select auth.uid()));
create policy "Users can block"
  on public.blocks for insert to authenticated
  with check (blocker_id = (select auth.uid()));
create policy "Users can unblock"
  on public.blocks for delete to authenticated
  using (blocker_id = (select auth.uid()));

-- Has either of these two people blocked the other?
create or replace function public.is_blocked_between(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;
revoke execute on function public.is_blocked_between(uuid, uuid) from public, anon;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;

-- Blocked people can't send you offers...
create or replace function public.check_offer_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_blocked_between(new.sender_id, new.recipient_id) then
    raise exception 'You can''t trade with this person.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger offers_check_block before insert on public.offers
  for each row execute function public.check_offer_block();

-- ...or messages (trade chat or direct messages).
create or replace function public.check_message_block()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_other uuid;
begin
  if tg_table_name = 'trade_messages' then
    if new.sender_id is null then return new; end if;
    select case when o.sender_id = new.sender_id then o.recipient_id else o.sender_id end into v_other
    from public.offers o where o.id = new.offer_id;
  else
    select case when t.user_a = new.sender_id then t.user_b else t.user_a end into v_other
    from public.direct_threads t where t.id = new.thread_id;
  end if;
  if public.is_blocked_between(new.sender_id, v_other) then
    raise exception 'You can''t message this person.' using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger trade_messages_check_block before insert on public.trade_messages
  for each row execute function public.check_message_block();
create trigger direct_messages_check_block before insert on public.direct_messages
  for each row execute function public.check_message_block();
