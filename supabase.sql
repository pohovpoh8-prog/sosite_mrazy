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
