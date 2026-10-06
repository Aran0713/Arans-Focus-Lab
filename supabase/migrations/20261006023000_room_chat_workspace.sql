-- Shared focus chat, private room files, and live participant focus totals.

create or replace function private.is_room_member(p_room uuid, p_present boolean default false)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.room_members m
    where m.room_id=p_room
      and m.user_id=auth.uid()
      and (not p_present or m.is_present)
  )
$$;

create or replace function private.is_active_room(p_room uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(select 1 from public.focus_rooms r where r.id=p_room and r.status='active')
$$;

create or replace function private.file_room_id(p_name text)
returns uuid
language plpgsql
immutable
security definer
set search_path=''
as $$
begin
  return split_part(p_name,'/',1)::uuid;
exception when others then
  return null;
end
$$;

grant execute on function private.is_room_member(uuid,boolean) to authenticated;
grant execute on function private.is_active_room(uuid) to authenticated;
grant execute on function private.file_room_id(text) to authenticated;

create table if not exists public.room_messages(
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.focus_rooms(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null default '',
  created_at timestamptz not null default now(),
  constraint room_messages_body_length check (char_length(body) <= 4000),
  unique(id,room_id)
);

create index if not exists room_messages_room_created_idx
  on public.room_messages(room_id,created_at);

alter table public.room_messages enable row level security;

drop policy if exists room_messages_read on public.room_messages;
create policy room_messages_read on public.room_messages
for select to authenticated
using (private.is_room_member(room_id,false));

drop policy if exists room_messages_send on public.room_messages;
create policy room_messages_send on public.room_messages
for insert to authenticated
with check (
  sender_id=auth.uid()
  and private.is_room_member(room_id,true)
  and private.is_active_room(room_id)
);

drop policy if exists room_messages_delete_own on public.room_messages;
create policy room_messages_delete_own on public.room_messages
for delete to authenticated
using (sender_id=auth.uid());

create table if not exists public.room_message_attachments(
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null,
  room_id uuid not null,
  uploader_id uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null default 'application/octet-stream',
  size_bytes bigint not null,
  created_at timestamptz not null default now(),
  constraint room_message_attachments_size check (size_bytes > 0 and size_bytes <= 20971520),
  constraint room_message_attachments_name check (char_length(file_name) between 1 and 180),
  constraint room_message_attachments_message_fk foreign key(message_id,room_id)
    references public.room_messages(id,room_id) on delete cascade
);

create index if not exists room_message_attachments_room_idx
  on public.room_message_attachments(room_id,created_at);

alter table public.room_message_attachments enable row level security;

drop policy if exists room_attachments_read on public.room_message_attachments;
create policy room_attachments_read on public.room_message_attachments
for select to authenticated
using (private.is_room_member(room_id,false));

drop policy if exists room_attachments_add on public.room_message_attachments;
create policy room_attachments_add on public.room_message_attachments
for insert to authenticated
with check (
  uploader_id=auth.uid()
  and private.is_room_member(room_id,true)
  and exists(select 1 from public.room_messages m where m.id=message_id and m.room_id=room_id and m.sender_id=auth.uid())
);

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values(
  'focus-room-files',
  'focus-room-files',
  false,
  20971520,
  array[
    'application/pdf','image/png','image/jpeg','image/gif','image/webp',
    'text/plain','text/markdown','text/csv',
    'application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint','application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip','application/octet-stream'
  ]::text[]
)
on conflict(id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists focus_room_files_read on storage.objects;
create policy focus_room_files_read on storage.objects
for select to authenticated
using (
  bucket_id='focus-room-files'
  and private.is_room_member(private.file_room_id(name),false)
);

drop policy if exists focus_room_files_upload on storage.objects;
create policy focus_room_files_upload on storage.objects
for insert to authenticated
with check (
  bucket_id='focus-room-files'
  and split_part(name,'/',2)=auth.uid()::text
  and private.is_room_member(private.file_room_id(name),true)
  and private.is_active_room(private.file_room_id(name))
);

drop policy if exists focus_room_files_delete_own on storage.objects;
create policy focus_room_files_delete_own on storage.objects
for delete to authenticated
using (
  bucket_id='focus-room-files'
  and split_part(name,'/',2)=auth.uid()::text
);

do $$
begin
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='room_messages'
  ) then
    alter publication supabase_realtime add table public.room_messages;
  end if;
  if not exists(
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='room_message_attachments'
  ) then
    alter publication supabase_realtime add table public.room_message_attachments;
  end if;
end $$;

create or replace function private.room_payload(p_room uuid, p_user uuid)
returns jsonb
language sql
stable
security definer
set search_path=''
as $$
  select to_jsonb(r)||jsonb_build_object(
    'members',coalesce((
      select jsonb_agg(
        to_jsonb(m)||jsonb_build_object(
          'name',prof.display_name,
          'session',(
            select jsonb_build_object(
              'id',s.id,
              'title',s.title,
              'status',s.status,
              'started_at',s.started_at,
              'finished_at',s.finished_at,
              'interval_started_at',(select i.started_at from public.focus_intervals i where i.session_id=s.id order by i.started_at desc limit 1),
              'focus_seconds',coalesce((select floor(sum(extract(epoch from (i.ended_at-i.started_at))))::bigint from public.focus_intervals i where i.session_id=s.id and i.kind='focus' and i.ended_at is not null),0),
              'break_seconds',coalesce((select floor(sum(extract(epoch from (i.ended_at-i.started_at))))::bigint from public.focus_intervals i where i.session_id=s.id and i.kind='break' and i.ended_at is not null),0),
              'goals',coalesce((select jsonb_agg(jsonb_build_object('id',g.id,'text',g.text,'completed',g.completed,'position',g.position) order by g.position) from public.session_goals g where g.session_id=s.id),'[]'::jsonb)
            )
            from public.focus_sessions s
            where s.room_id=r.id and s.user_id=m.user_id
            order by s.started_at desc limit 1
          )
        ) order by case when m.user_id=p_user then 0 else 1 end, prof.display_name
      )
      from public.room_members m
      join public.profiles prof on prof.id=m.user_id
      where m.room_id=r.id
    ),'[]'::jsonb)
  )
  from public.focus_rooms r where r.id=p_room
$$;
