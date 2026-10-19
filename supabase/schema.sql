-- Run in Supabase SQL editor.

create type public.user_role as enum ('admin', 'employee', 'company');

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role public.user_role not null,
  company_id uuid,
  created_at timestamptz default now()
);

create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gstin text,
  created_at timestamptz default now()
);

alter table public.profiles
  drop constraint if exists profiles_company_id_fkey;

alter table public.profiles
  add constraint profiles_company_id_fkey
  foreign key (company_id) references public.companies (id);

create table if not exists public.employee_assignments (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  entry_status text not null default 'pending'
    check (entry_status in ('pending', 'in_progress', 'complete')),
  unique (employee_id, company_id)
);

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.employee_assignments enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id);

-- After creating a user in Authentication > Users, insert a matching profile:
-- insert into public.profiles (id, email, full_name, role)
-- values ('<auth-user-uuid>', 'admin@example.com', 'Admin', 'admin');
