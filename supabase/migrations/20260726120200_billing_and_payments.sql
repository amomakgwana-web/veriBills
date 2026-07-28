-- veriBills :: 003 accounts, ledger, invoicing, payments, payment plans, DebiCheck

-- ---------------------------------------------------------------------------
-- Tenant accounts and the transaction ledger
-- ---------------------------------------------------------------------------

-- One account per lease. Balance is positive when the tenant owes money.
create table tenant_accounts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  lease_id          uuid not null unique references leases(id) on delete cascade,
  account_number    text not null,
  balance           numeric(14,2) not null default 0,
  -- Ageing buckets, refreshed by the ageing job.
  current_due       numeric(14,2) not null default 0,
  overdue_30        numeric(14,2) not null default 0,
  overdue_60        numeric(14,2) not null default 0,
  overdue_90        numeric(14,2) not null default 0,
  overdue_120_plus  numeric(14,2) not null default 0,
  last_payment_at   timestamptz,
  last_payment_amount numeric(14,2),
  is_on_payment_plan boolean not null default false,
  is_in_arrears     boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, account_number)
);

create index on tenant_accounts (org_id) where is_in_arrears;

-- Immutable, append-only. Every money movement lands here, tagged by channel,
-- which is what powers the per-channel transaction history in the portal.
create table ledger_entries (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  account_id        uuid not null references tenant_accounts(id) on delete cascade,
  direction         ledger_direction not null,
  channel           charge_type not null,
  amount            numeric(14,2) not null check (amount > 0),
  description       text not null,
  -- Running balance after this entry, set by trigger.
  balance_after     numeric(14,2),
  occurred_at       timestamptz not null default now(),
  invoice_id        uuid,       -- FK added after invoices
  payment_id        uuid,       -- FK added after payments
  reference         text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now()
);

create index on ledger_entries (account_id, occurred_at desc);
create index on ledger_entries (account_id, channel, occurred_at desc);
create index on ledger_entries (org_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Billing runs and invoices
-- ---------------------------------------------------------------------------

create table billing_runs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid references properties(id) on delete cascade,
  period_start      date not null,
  period_end        date not null,
  due_date          date not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'running', 'completed', 'failed', 'reversed')),
  invoices_created  int not null default 0,
  total_billed      numeric(16,2) not null default 0,
  error_message     text,
  started_at        timestamptz,
  completed_at      timestamptz,
  run_by            uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  check (period_end >= period_start)
);

create index on billing_runs (org_id, period_start desc);

create table invoices (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  account_id        uuid not null references tenant_accounts(id) on delete cascade,
  lease_id          uuid not null references leases(id) on delete cascade,
  unit_id           uuid not null references units(id) on delete restrict,
  billing_run_id    uuid references billing_runs(id) on delete set null,
  invoice_number    text not null,
  status            invoice_status not null default 'draft',
  period_start      date not null,
  period_end        date not null,
  issue_date        date not null default current_date,
  due_date          date not null,
  subtotal          numeric(14,2) not null default 0,
  vat_total         numeric(14,2) not null default 0,
  total             numeric(14,2) not null default 0,
  amount_paid       numeric(14,2) not null default 0 check (amount_paid >= 0),
  -- Generated so partial payment maths never drifts from the paid total.
  amount_due        numeric(14,2) generated always as (total - amount_paid) stored,
  pdf_path          text,
  sent_at           timestamptz,
  paid_at           timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, invoice_number)
);

create index on invoices (account_id, issue_date desc);
create index on invoices (org_id, status, due_date);
create index on invoices (lease_id, period_start desc);

create table invoice_lines (
  id                uuid primary key default gen_random_uuid(),
  invoice_id        uuid not null references invoices(id) on delete cascade,
  channel           charge_type not null,
  description       text not null,
  quantity          numeric(14,3) not null default 1 check (quantity >= 0),
  unit_price        numeric(14,6) not null default 0,
  net_amount        numeric(14,2) not null default 0,
  vat_rate          numeric(5,4) not null default 0,
  vat_amount        numeric(14,2) not null default 0,
  total_amount      numeric(14,2) not null default 0,
  meter_id          uuid references meters(id) on delete set null,
  reading_from      numeric(14,3),
  reading_to        numeric(14,3),
  sequence          int not null default 0,
  created_at        timestamptz not null default now()
);

create index on invoice_lines (invoice_id, sequence);

alter table ledger_entries
  add constraint ledger_entries_invoice_fk foreign key (invoice_id) references invoices(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Payments (card with 3DS, EFT, DebiCheck collections)
-- ---------------------------------------------------------------------------

create table payments (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  account_id        uuid references tenant_accounts(id) on delete set null,
  profile_id        uuid references profiles(id) on delete set null,
  payment_method_id uuid references payment_methods(id) on delete set null,
  reference         text not null,
  method            payment_method not null,
  status            payment_status not null default 'initiated',
  amount            numeric(14,2) not null check (amount > 0),
  currency_code     char(3) not null default 'ZAR',
  -- What the tenant chose to pay towards; allocation rows carry the detail.
  intent_channel    charge_type,
  gateway           text,
  gateway_reference text,
  -- 3-D Secure
  three_ds_required boolean not null default false,
  three_ds_status   text check (three_ds_status in ('pending', 'challenged', 'frictionless', 'authenticated', 'failed', 'bypassed')),
  three_ds_version  text,
  three_ds_redirect_url text,
  three_ds_completed_at timestamptz,
  failure_code      text,
  failure_reason    text,
  -- Large payments can require internal approval before release.
  requires_approval boolean not null default false,
  approval_id       uuid,   -- FK added in 005
  authorised_at     timestamptz,
  captured_at       timestamptz,
  settled_at        timestamptz,
  reversed_at       timestamptz,
  receipt_sent_at   timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, reference)
);

create index on payments (account_id, created_at desc);
create index on payments (org_id, status, created_at desc);
create index on payments (gateway, gateway_reference);

alter table ledger_entries
  add constraint ledger_entries_payment_fk foreign key (payment_id) references payments(id) on delete set null;

-- How a payment was split across invoices/channels.
create table payment_allocations (
  id                uuid primary key default gen_random_uuid(),
  payment_id        uuid not null references payments(id) on delete cascade,
  invoice_id        uuid references invoices(id) on delete set null,
  channel           charge_type not null,
  amount            numeric(14,2) not null check (amount > 0),
  created_at        timestamptz not null default now()
);

create index on payment_allocations (payment_id);
create index on payment_allocations (invoice_id);

-- ---------------------------------------------------------------------------
-- Payment plans (arrangements for tenants in arrears)
-- ---------------------------------------------------------------------------

create table payment_plans (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  account_id        uuid not null references tenant_accounts(id) on delete cascade,
  reference         text not null,
  status            payment_plan_status not null default 'proposed',
  arrears_amount    numeric(14,2) not null check (arrears_amount > 0),
  deposit_amount    numeric(14,2) not null default 0 check (deposit_amount >= 0),
  instalment_amount numeric(14,2) not null check (instalment_amount > 0),
  instalment_count  int not null check (instalment_count > 0),
  frequency         charge_frequency not null default 'monthly',
  first_due_date    date not null,
  -- Plan keeps the normal monthly bill running alongside the arrears catch-up.
  includes_current_charges boolean not null default true,
  amount_paid       numeric(14,2) not null default 0,
  proposed_by       uuid references profiles(id) on delete set null,
  accepted_at       timestamptz,
  accepted_by       uuid references profiles(id) on delete set null,
  defaulted_at      timestamptz,
  completed_at      timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, reference)
);

create index on payment_plans (account_id, status);

create table payment_plan_instalments (
  id                uuid primary key default gen_random_uuid(),
  plan_id           uuid not null references payment_plans(id) on delete cascade,
  sequence          int not null,
  due_date          date not null,
  amount            numeric(14,2) not null check (amount > 0),
  amount_paid       numeric(14,2) not null default 0,
  paid_at           timestamptz,
  payment_id        uuid references payments(id) on delete set null,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'part_paid', 'missed', 'waived')),
  unique (plan_id, sequence)
);

-- ---------------------------------------------------------------------------
-- DebiCheck mandates and collections
-- ---------------------------------------------------------------------------

create table debicheck_mandates (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  account_id        uuid not null references tenant_accounts(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  contract_reference text not null,
  mandate_reference text,
  status            mandate_status not null default 'draft',
  -- Authenticated collection amount and the ceiling the debtor agreed to.
  instalment_amount numeric(14,2) not null check (instalment_amount > 0),
  maximum_amount    numeric(14,2) not null check (maximum_amount > 0),
  frequency         charge_frequency not null default 'monthly',
  collection_day    int not null check (collection_day between 1 and 31),
  first_collection_date date not null,
  last_collection_date  date,
  -- Debtor bank details
  bank_name         text not null,
  branch_code       text not null,
  account_number_masked text not null,
  account_type      text check (account_type in ('cheque', 'savings', 'transmission')),
  -- Authentication (TT1 real-time / TT2 batch / TT3 card+PIN at ATM)
  authentication_type text check (authentication_type in ('TT1', 'TT2', 'TT3')),
  authenticated_at  timestamptz,
  -- Debtor may accept a yearly escalation on the mandate amount.
  adjustment_category text check (adjustment_category in ('never', 'quarterly', 'biannually', 'annually', 'repo')),
  adjustment_rate   numeric(6,3),
  tracking_enabled  boolean not null default true,
  cancelled_at      timestamptz,
  cancellation_reason text,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, contract_reference),
  check (maximum_amount >= instalment_amount)
);

create index on debicheck_mandates (account_id, status);
create index on debicheck_mandates (org_id, status);

create table mandate_events (
  id                uuid primary key default gen_random_uuid(),
  mandate_id        uuid not null references debicheck_mandates(id) on delete cascade,
  event_type        text not null,
  from_status       mandate_status,
  to_status         mandate_status,
  payload           jsonb not null default '{}'::jsonb,
  occurred_at       timestamptz not null default now()
);

create index on mandate_events (mandate_id, occurred_at desc);

create table collection_runs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  action_date       date not null,
  status            text not null default 'draft'
                    check (status in ('draft', 'submitted', 'processing', 'completed', 'failed')),
  mandate_count     int not null default 0,
  total_amount      numeric(16,2) not null default 0,
  successful_count  int not null default 0,
  failed_count      int not null default 0,
  submitted_at      timestamptz,
  completed_at      timestamptz,
  created_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now()
);

create table collections (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  run_id            uuid references collection_runs(id) on delete set null,
  mandate_id        uuid not null references debicheck_mandates(id) on delete cascade,
  account_id        uuid not null references tenant_accounts(id) on delete cascade,
  payment_id        uuid references payments(id) on delete set null,
  status            collection_status not null default 'scheduled',
  amount            numeric(14,2) not null check (amount > 0),
  action_date       date not null,
  -- Tracking retries a failed collection when funds land in the account.
  is_tracking_retry boolean not null default false,
  retry_of          uuid references collections(id) on delete set null,
  response_code     text,
  response_reason   text,
  submitted_at      timestamptz,
  resolved_at       timestamptz,
  created_at        timestamptz not null default now()
);

create index on collections (mandate_id, action_date desc);
create index on collections (org_id, status, action_date);

create trigger tenant_accounts_updated_at before update on tenant_accounts
  for each row execute function set_updated_at();
create trigger invoices_updated_at before update on invoices
  for each row execute function set_updated_at();
create trigger payments_updated_at before update on payments
  for each row execute function set_updated_at();
create trigger payment_plans_updated_at before update on payment_plans
  for each row execute function set_updated_at();
create trigger debicheck_mandates_updated_at before update on debicheck_mandates
  for each row execute function set_updated_at();
