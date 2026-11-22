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

create table if not exists public.employee_work_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  company_id uuid not null references public.companies (id) on delete cascade,
  login_time timestamptz not null default now(),
  logout_time timestamptz,
  total_hours numeric(8, 2),
  completed_tasks text[] not null default '{}',
  pending_work text[] not null default '{}',
  pending_tasks text[] not null default '{}',
  created_at timestamptz not null default now(),
  check (logout_time is null or logout_time >= login_time),
  check (total_hours is null or total_hours >= 0)
);

create table if not exists public.sync_runs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies (id) on delete cascade,
  worker_id text not null,
  status text not null check (status in ('running', 'success', 'partial', 'failed')),
  vouchers_processed int not null default 0,
  duration_ms int not null default 0,
  error_message text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists sync_runs_company_started_idx
  on public.sync_runs (company_id, started_at desc);

create index if not exists employee_work_logs_user_login_idx
  on public.employee_work_logs (user_id, login_time desc);
create index if not exists employee_work_logs_company_login_idx
  on public.employee_work_logs (company_id, login_time desc);
create index if not exists employee_work_logs_company_user_login_idx
  on public.employee_work_logs (company_id, user_id, login_time desc);

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
  period_date date not null,
  period_start date not null,
  period_end date not null,
  total_sales numeric(18, 2) not null default 0,
  total_purchases numeric(18, 2) not null default 0,
  total_expenses numeric(18, 2) not null default 0,
  net_profit numeric(18, 2) not null default 0,
  gst_payable numeric(18, 2) not null default 0,
  gst_input numeric(18, 2) not null default 0,
  last_synced_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (company_id, period_start),
  check (period_end >= period_start)
);

alter table public.financial_summaries
  add column if not exists period_date date,
  add column if not exists gst_input numeric(18, 2) not null default 0,
  add column if not exists last_synced_at timestamptz;

update public.financial_summaries
set period_date = period_start
where period_start is not null
  and period_date is distinct from period_start;

alter table public.financial_summaries
  alter column period_date set not null,
  alter column last_synced_at drop not null,
  alter column last_synced_at drop default;

create index if not exists vouchers_company_date_idx
  on public.vouchers (company_id, voucher_date desc);
create index if not exists vouchers_company_date_type_idx
  on public.vouchers (company_id, voucher_date desc, voucher_type);
create index if not exists vouchers_company_number_idx
  on public.vouchers (company_id, voucher_number);

create index if not exists financial_summaries_company_period_idx
  on public.financial_summaries (company_id, period_start);

alter table public.employee_work_logs
  add column if not exists pending_work text[] not null default '{}',
  add column if not exists pending_tasks text[] not null default '{}';

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.audit_logs
  add column if not exists actor_id uuid references auth.users (id) on delete set null,
  add column if not exists action text not null default 'unknown',
  add column if not exists entity_type text not null default 'unknown',
  add column if not exists entity_id text,
  add column if not exists details jsonb not null default '{}'::jsonb,
  add column if not exists created_at timestamptz not null default now();

alter table public.audit_logs enable row level security;

create or replace function public.recalculate_financial_summary_for_voucher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_rows_sql text;
begin
  if tg_op = 'INSERT' then
    changed_rows_sql := 'select company_id, voucher_date from new_table';
  elsif tg_op = 'UPDATE' then
    changed_rows_sql :=
      'select company_id, voucher_date from old_table '
      'union all select company_id, voucher_date from new_table';
  elsif tg_op = 'DELETE' then
    changed_rows_sql := 'select company_id, voucher_date from old_table';
  else
    return null;
  end if;

  execute
    'with affected as (
       select distinct company_id,
         date_trunc(''month'', voucher_date)::date as period_start
       from (' || changed_rows_sql || ') changed
     ),
     monthly_totals as (
       select
         affected.company_id,
         affected.period_start,
         coalesce(sum(v.sales_amount), 0)::numeric(18, 2) as sales,
         coalesce(sum(v.purchase_amount), 0)::numeric(18, 2) as purchases,
         coalesce(sum(v.expense_amount), 0)::numeric(18, 2) as expenses,
         coalesce(sum(v.cgst_amount + v.sgst_amount + v.igst_amount)
           filter (where v.voucher_type = ''sales''), 0)::numeric(18, 2) as gst_payable,
         coalesce(sum(v.cgst_amount + v.sgst_amount + v.igst_amount)
           filter (where v.voucher_type = ''purchase''), 0)::numeric(18, 2) as gst_input
       from affected
       left join public.vouchers v
         on v.company_id = affected.company_id
        and v.voucher_date >= affected.period_start
        and v.voucher_date < (affected.period_start + interval ''1 month'')::date
       group by affected.company_id, affected.period_start
     )
     insert into public.financial_summaries (
       company_id, period_date, period_start, period_end,
       total_sales, total_purchases, total_expenses, net_profit,
       gst_payable, gst_input, last_synced_at, updated_at
     )
     select
       company_id, period_start, period_start,
       (period_start + interval ''1 month - 1 day'')::date,
       sales, purchases, expenses, sales - purchases - expenses,
       gst_payable, gst_input, now(), now()
     from monthly_totals
     on conflict (company_id, period_start)
     do update set
       period_date = excluded.period_date,
       period_end = excluded.period_end,
       total_sales = excluded.total_sales,
       total_purchases = excluded.total_purchases,
       total_expenses = excluded.total_expenses,
       net_profit = excluded.net_profit,
       gst_payable = excluded.gst_payable,
       gst_input = excluded.gst_input,
       last_synced_at = excluded.last_synced_at,
       updated_at = excluded.updated_at';
  return null;
end;
$$;

drop trigger if exists trg_auto_recalculate_financial_summary on public.vouchers;
drop trigger if exists trg_vouchers_auto_summary on public.vouchers;
create trigger trg_auto_recalculate_financial_summary_insert
after insert on public.vouchers
referencing new table as new_table
for each statement execute function public.recalculate_financial_summary_for_voucher();

create trigger trg_auto_recalculate_financial_summary_update
after update on public.vouchers
referencing old table as old_table new table as new_table
for each statement execute function public.recalculate_financial_summary_for_voucher();

create trigger trg_auto_recalculate_financial_summary_delete
after delete on public.vouchers
referencing old table as old_table
for each statement execute function public.recalculate_financial_summary_for_voucher();

insert into public.financial_summaries (
  company_id,
  period_date,
  period_start,
  period_end,
  total_sales,
  total_purchases,
  total_expenses,
  net_profit,
  gst_payable,
  gst_input,
  last_synced_at,
  updated_at
)
select
  company_id,
  date_trunc('month', voucher_date)::date,
  date_trunc('month', voucher_date)::date,
  (date_trunc('month', voucher_date) + interval '1 month - 1 day')::date,
  coalesce(sum(sales_amount), 0),
  coalesce(sum(purchase_amount), 0),
  coalesce(sum(expense_amount), 0),
  coalesce(sum(sales_amount - purchase_amount - expense_amount), 0),
  coalesce(sum(cgst_amount + sgst_amount + igst_amount)
    filter (where voucher_type = 'sales'), 0),
  coalesce(sum(cgst_amount + sgst_amount + igst_amount)
    filter (where voucher_type = 'purchase'), 0),
  null,
  now()
from public.vouchers
group by company_id, date_trunc('month', voucher_date)
on conflict (company_id, period_start)
do update set
  period_date = excluded.period_date,
  period_end = excluded.period_end,
  total_sales = excluded.total_sales,
  total_purchases = excluded.total_purchases,
  total_expenses = excluded.total_expenses,
  net_profit = excluded.net_profit,
  gst_payable = excluded.gst_payable,
  gst_input = excluded.gst_input,
  updated_at = excluded.updated_at;

create or replace function public.audit_voucher_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.audit_logs (
    actor_id,
    action,
    entity_type,
    entity_id,
    details
  )
  values (
    auth.uid(),
    case tg_op
      when 'INSERT' then 'voucher_created'
      when 'UPDATE' then 'voucher_updated'
      when 'DELETE' then 'voucher_deleted'
    end,
    'voucher',
    coalesce(new.tally_voucher_id, old.tally_voucher_id),
    jsonb_build_object(
      'operation', tg_op,
      'company_id', coalesce(new.company_id, old.company_id),
      'voucher_date', coalesce(new.voucher_date, old.voucher_date)
    )
  );
  return null;
end;
$$;

drop trigger if exists trg_audit_voucher_change on public.vouchers;
create trigger trg_audit_voucher_change
after insert or update or delete on public.vouchers
for each row execute function public.audit_voucher_change();

alter table public.profiles enable row level security;
alter table public.companies enable row level security;
alter table public.company_employees enable row level security;
alter table public.employee_work_logs enable row level security;
alter table public.vouchers enable row level security;
alter table public.financial_summaries enable row level security;
alter table public.sync_runs enable row level security;

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

drop policy if exists "Admins can read audit logs" on public.audit_logs;
create policy "Admins can read audit logs"
  on public.audit_logs
  for select
  to authenticated
  using (public.is_admin());

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

drop policy if exists "Employees can read own work logs" on public.employee_work_logs;
create policy "Employees can read own work logs"
  on public.employee_work_logs
  for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

drop policy if exists "Employees can create own work logs" on public.employee_work_logs;
create policy "Employees can create own work logs"
  on public.employee_work_logs
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'employee'
    )
    and exists (
      select 1
      from public.company_employees
      where company_employees.employee_id = auth.uid()
        and company_employees.company_id = employee_work_logs.company_id
    )
  );

drop policy if exists "Employees can update own work logs" on public.employee_work_logs;
create policy "Employees can update own work logs"
  on public.employee_work_logs
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

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

drop policy if exists "Users can read authorized sync runs" on public.sync_runs;
create policy "Users can read authorized sync runs"
  on public.sync_runs
  for select
  to authenticated
  using (
    public.is_admin()
    or exists (
      select 1
      from public.profiles
      where profiles.id = auth.uid()
        and profiles.company_id = sync_runs.company_id
    )
    or exists (
      select 1
      from public.company_employees
      where company_employees.company_id = sync_runs.company_id
        and company_employees.employee_id = auth.uid()
    )
  );

-- Create the first admin in Supabase Auth, then insert its matching profile:
-- insert into public.profiles (id, email, full_name, role)
-- values ('<auth-user-uuid>', 'admin@example.com', 'Admin', 'admin');
