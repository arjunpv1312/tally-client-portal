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

alter table public.company_employees
  add column if not exists entry_status text not null default 'pending';

create table if not exists public.vouchers (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  tally_voucher_id text not null,
  voucher_number text,
  voucher_type text not null
    check (voucher_type in ('sales', 'purchase', 'receipt', 'payment')),
  date date,
  voucher_date date not null,
  party_name text,
  narration text,
  total_amount numeric(18, 2) not null default 0,
  amount numeric(18, 2) not null default 0,
  sales_amount numeric(18, 2) not null default 0,
  purchase_amount numeric(18, 2) not null default 0,
  expense_amount numeric(18, 2) not null default 0,
  cgst_amount numeric(18, 2) not null default 0,
  sgst_amount numeric(18, 2) not null default 0,
  igst_amount numeric(18, 2) not null default 0,
  raw_ledger_entries jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, tally_voucher_id)
);

alter table public.vouchers
  add column if not exists date date,
  add column if not exists amount numeric(18, 2) not null default 0,
  add column if not exists narration text;

create table if not exists public.financial_summaries (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  period_start date not null,
  period_end date not null,
  total_sales numeric(18, 2) not null default 0,
  total_purchases numeric(18, 2) not null default 0,
  total_expenses numeric(18, 2) not null default 0,
  net_profit numeric(18, 2) not null default 0,
  gst_payable numeric(18, 2) not null default 0,
  gst_input numeric(18, 2) not null default 0,
  last_synced_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, period_start),
  check (period_end >= period_start)
);

create index if not exists vouchers_company_date_idx
  on public.vouchers (company_id, voucher_date desc);

create index if not exists financial_summaries_company_period_idx
  on public.financial_summaries (company_id, period_start);

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_employees enable row level security;
alter table public.vouchers enable row level security;
alter table public.financial_summaries enable row level security;

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

drop policy if exists "Users can read authorized company vouchers" on public.vouchers;
create policy "Users can read authorized company vouchers"
  on public.vouchers
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.company_id = vouchers.company_id
    )
    or exists (
      select 1
      from public.company_employees
      where company_employees.company_id = vouchers.company_id
        and company_employees.employee_id = auth.uid()
    )
  );

drop policy if exists "Users can read authorized financial summaries" on public.financial_summaries;
create policy "Users can read authorized financial summaries"
  on public.financial_summaries
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.company_id = financial_summaries.company_id
    )
    or exists (
      select 1
      from public.company_employees
      where company_employees.company_id = financial_summaries.company_id
        and company_employees.employee_id = auth.uid()
    )
  );

-- Create the first admin in Supabase Auth, then insert its matching profile:
-- insert into public.profiles (id, email, full_name, role)
-- values ('<auth-user-uuid>', 'admin@example.com', 'Admin', 'admin');
