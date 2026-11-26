-- =====================================================================
-- 0007_chat.sql
-- Live chat outside of trades:
--   room chat        one live group chat per community (members only)
--   direct messages  1-on-1 chats started from a profile or listing
-- Both stream in real time (Supabase Realtime). Run after 0006.
-- =====================================================================


-- ---------------------------------------------------------------------
-- ROOM CHAT: a live group chat for each community.
-- ---------------------------------------------------------------------
create table public.room_messages (
  id           uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities (id) on delete cascade,
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  body         text not null check (char_length(body) between 1 and 1000),
  created_at   timestamptz not null default now()
);

create index room_messages_community_idx on public.room_messages (community_id, created_at desc);

alter table public.room_messages enable row level security;

create policy "Members can read their room chat"
  on public.room_messages for select to authenticated
  using (public.is_member(community_id));
create policy "Members can post in their room chat"
  on public.room_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_member(community_id));
create policy "Senders can delete their room messages"
  on public.room_messages for delete to authenticated
  using (sender_id = (select auth.uid()));


-- ---------------------------------------------------------------------
-- DIRECT MESSAGES: one thread per pair of people.
-- user_a is always the "smaller" id, so each pair has exactly one thread.
-- ---------------------------------------------------------------------
create table public.direct_threads (
  id                uuid primary key default gen_random_uuid(),
  user_a            uuid not null references public.profiles (id) on delete cascade,
  user_b            uuid not null references public.profiles (id) on delete cascade,
  last_message_at   timestamptz,
  last_message      text,
  user_a_last_read  timestamptz,
  user_b_last_read  timestamptz,
  created_at        timestamptz not null default now(),
  unique (user_a, user_b),
  check (user_a < user_b)
);

create index direct_threads_a_idx on public.direct_threads (user_a, last_message_at desc);
create index direct_threads_b_idx on public.direct_threads (user_b, last_message_at desc);

create table public.direct_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.direct_threads (id) on delete cascade,
  sender_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index direct_messages_thread_idx on public.direct_messages (thread_id, created_at);

-- Is the logged-in user in this DM thread?
create or replace function public.is_thread_participant(p_thread_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.direct_threads t
    where t.id = p_thread_id and auth.uid() in (t.user_a, t.user_b)
  );
$$;

-- start_direct_chat: get (or create) the thread between you and someone.
create or replace function public.start_direct_chat(p_other uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_a uuid;
  v_b uuid;
  v_id uuid;
begin
  if v_user is null then
    raise exception 'You need to be logged in.' using errcode = '28000';
  end if;
  if p_other is null or p_other = v_user or not exists (select 1 from public.profiles p where p.id = p_other) then
    raise exception 'You can''t message that person.' using errcode = '22023';
  end if;

  v_a := least(v_user, p_other);
  v_b := greatest(v_user, p_other);

  insert into public.direct_threads (user_a, user_b) values (v_a, v_b)
  on conflict (user_a, user_b) do nothing;

  select t.id into v_id from public.direct_threads t where t.user_a = v_a and t.user_b = v_b;
  return v_id;
end;
$$;

-- mark_thread_read: remember that you've seen everything in a thread.
create or replace function public.mark_thread_read(p_thread_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.direct_threads t
     set user_a_last_read = case when t.user_a = auth.uid() then now() else t.user_a_last_read end,
         user_b_last_read = case when t.user_b = auth.uid() then now() else t.user_b_last_read end
   where t.id = p_thread_id and auth.uid() in (t.user_a, t.user_b);
$$;

-- unread_chat_count: how many DM threads have messages you haven't seen.
create or replace function public.unread_chat_count()
returns int
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::int from public.direct_threads t
  where t.last_message_at is not null
    and (
      (t.user_a = auth.uid() and (t.user_a_last_read is null or t.last_message_at > t.user_a_last_read))
      or (t.user_b = auth.uid() and (t.user_b_last_read is null or t.last_message_at > t.user_b_last_read))
    );
$$;

-- Keep each thread's "last message" preview up to date, and count the
-- sender as having read their own message.
create or replace function public.on_direct_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.direct_threads t
     set last_message_at = new.created_at,
         last_message = left(new.body, 120),
         user_a_last_read = case when t.user_a = new.sender_id then new.created_at else t.user_a_last_read end,
         user_b_last_read = case when t.user_b = new.sender_id then new.created_at else t.user_b_last_read end
   where t.id = new.thread_id;
  return new;
end;
$$;

create trigger direct_messages_update_thread
  after insert on public.direct_messages
  for each row execute function public.on_direct_message();

revoke execute on function public.start_direct_chat(uuid) from public, anon;
revoke execute on function public.mark_thread_read(uuid) from public, anon;
revoke execute on function public.unread_chat_count() from public, anon;
revoke execute on function public.is_thread_participant(uuid) from public, anon;
grant execute on function public.start_direct_chat(uuid) to authenticated;
grant execute on function public.mark_thread_read(uuid) to authenticated;
grant execute on function public.unread_chat_count() to authenticated;
grant execute on function public.is_thread_participant(uuid) to authenticated;

alter table public.direct_threads  enable row level security;
alter table public.direct_messages enable row level security;

-- Threads are created/updated by the functions above; you can only see yours.
create policy "Participants can view their threads"
  on public.direct_threads for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));

create policy "Participants can read their messages"
  on public.direct_messages for select to authenticated
  using (public.is_thread_participant(thread_id));
create policy "Participants can send messages"
  on public.direct_messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_thread_participant(thread_id));


-- =====================================================================
-- REALTIME: stream new room and direct messages.
-- =====================================================================
alter publication supabase_realtime add table public.room_messages;
alter publication supabase_realtime add table public.direct_messages;
