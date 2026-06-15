-- ============================================================================
-- 0006_chat_and_notifications.sql
--   * chat_threads / chat_messages — persisted AI copilot conversations,
--     owner-scoped (the profile behind auth.uid()).
--   * notification_reads — per-user read state for the (derived) topbar
--     notifications, so "mark as read" sticks.
-- RLS: each row is private to its owning profile via current_profile_id().
-- ============================================================================

-- ---- Chat threads -----------------------------------------------------------
create table public.chat_threads (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title      text not null default 'New conversation',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index chat_threads_profile_idx
  on public.chat_threads (profile_id, updated_at desc);

create table public.chat_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.chat_threads (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant')),
  content    text not null,
  created_at timestamptz not null default now()
);
create index chat_messages_thread_idx
  on public.chat_messages (thread_id, created_at);

-- ---- Notification read-state ------------------------------------------------
create table public.notification_reads (
  id         uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  notif_key  text not null,
  created_at timestamptz not null default now(),
  unique (profile_id, notif_key)
);
create index notification_reads_profile_idx
  on public.notification_reads (profile_id);

-- ---- RLS --------------------------------------------------------------------
alter table public.chat_threads enable row level security;
alter table public.chat_messages enable row level security;
alter table public.notification_reads enable row level security;

create policy chat_threads_owner on public.chat_threads
  for all
  using (profile_id = (select public.current_profile_id()))
  with check (profile_id = (select public.current_profile_id()));

create policy chat_messages_owner on public.chat_messages
  for all
  using (
    thread_id in (
      select id from public.chat_threads
       where profile_id = (select public.current_profile_id())
    )
  )
  with check (
    thread_id in (
      select id from public.chat_threads
       where profile_id = (select public.current_profile_id())
    )
  );

create policy notification_reads_owner on public.notification_reads
  for all
  using (profile_id = (select public.current_profile_id()))
  with check (profile_id = (select public.current_profile_id()));
