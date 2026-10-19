-- Run in Supabase SQL editor.

do $$
begin
  create type public.user_role as enum ('admin', 'employee', 'company');
exception
  when duplicate_object then null;
end
$$;

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
  email text,
  phone text,
  created_at timestamptz default now()
);

alter table public.companies
  add column if not exists email text,
  add column if not exists phone text;

alter table public.profiles
  drop constraint if exists profiles_company_id_fkey;

alter table public.profiles
  add constraint profiles_company_id_fkey
  foreign key (company_id) references public.companies (id);

do $$
begin
  if to_regclass('public.company_employees') is null
     and to_regclass('public.employee_assignments') is not null then
    alter table public.employee_assignments rename to company_employees;
  end if;
end
$$;

create table if not exists public.company_employees (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  entry_status text not null default 'pending'
    check (entry_status in ('pending', 'in_progress', 'complete')),
  unique (employee_id, company_id)
);

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_employees enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and role = 'admin'
  );
$$;

drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles
  for select
  to authenticated
  using (auth.uid() = id or public.is_admin());

drop policy if exists "Admins can manage companies" on public.companies;
create policy "Admins can manage companies"
  on public.companies
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

drop policy if exists "Users can read assigned companies" on public.companies;
create policy "Users can read assigned companies"
  on public.companies
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.company_id = companies.id
    )
    or exists (
      select 1
      from public.company_employees
      where company_employees.company_id = companies.id
        and company_employees.employee_id = auth.uid()
    )
  );

drop policy if exists "Users can read own company assignments" on public.company_employees;
create policy "Users can read own company assignments"
  on public.company_employees
  for select
  to authenticated
  using (
    public.is_admin()
    or employee_id = auth.uid()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.company_id = company_employees.company_id
    )
  );

drop policy if exists "Admins can manage company assignments" on public.company_employees;
create policy "Admins can manage company assignments"
  on public.company_employees
  for all
  to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Create the first admin in Supabase Auth, then insert its matching profile:
-- insert into public.profiles (id, email, full_name, role)
-- values ('<auth-user-uuid>', 'admin@example.com', 'Admin', 'admin');
