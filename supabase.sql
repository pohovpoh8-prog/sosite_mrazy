-- Supabase: база данных для комментариев сайта Дмитрия
-- Выполните этот SQL целиком в Supabase Dashboard -> SQL Editor.

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 40),
  message text not null check (char_length(trim(message)) between 1 and 500),
  created_at timestamptz not null default now()
);

-- Включаем Row Level Security.
alter table public.comments enable row level security;

-- Клиентскому приложению нужны только SELECT и INSERT.
revoke all on table public.comments from anon, authenticated;
grant select, insert on table public.comments to anon, authenticated;

drop policy if exists "Anyone can read comments" on public.comments;
create policy "Anyone can read comments"
on public.comments
for select
to anon, authenticated
using (true);

drop policy if exists "Anyone can add comments" on public.comments;
create policy "Anyone can add comments"
on public.comments
for insert
to anon, authenticated
with check (true);

-- Индекс для быстрой сортировки новых комментариев.
create index if not exists comments_created_at_idx
on public.comments (created_at desc);

-- Администраторы: только пользователи из этой таблицы могут удалять комментарии.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade
);

alter table public.admin_users enable row level security;

revoke all on table public.admin_users from anon, authenticated;
grant select on table public.admin_users to authenticated;
grant delete on table public.comments to authenticated;

drop policy if exists "Admins can view their own admin record" on public.admin_users;
create policy "Admins can view their own admin record"
on public.admin_users for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "Only admins can delete comments" on public.comments;
create policy "Only admins can delete comments"
on public.comments for delete
to authenticated
using (exists (
  select 1 from public.admin_users a where a.user_id = auth.uid()
));
