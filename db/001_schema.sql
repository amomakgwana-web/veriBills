-- veriBills.com — core schema.
--
-- This project shares a single Supabase project ("xBilling") with an
-- unrelated municipal billing platform. Every schema here is prefixed
-- `vb_` specifically to guarantee zero collision with that platform's
-- `platform`/`billing`/`payments`/`metering`/`comms`/`compliance` schemas
-- — the two products live in the same Postgres instance but never share a
-- table, a view, or an RPC function name. See db/010 for how the one
-- Custom Access Token Hook a Supabase project can have is shared between
-- both products without either one seeing the other's claims.
--
-- Domain model, per the Technical Platform Document (v3.0):
--   vb_platform  — estates, units, leases, platform users (8 roles), tenant invites
--   vb_metering  — meters, readings, tariffs, prepaid electricity tokens
--   vb_billing   — invoices (rent+levies+water+metered electricity), credit
--                  notes, disputes, dunning log, payment transactions
--   vb_ops       — arrears case pipeline, legal escalation, payment plans,
--                  bill/statement templates
--   vb_events    — xLayer's append-only event log + webhook relay

create schema if not exists vb_platform;
create schema if not exists vb_metering;
create schema if not exists vb_billing;
create schema if not exists vb_ops;
create schema if not exists vb_events;

-- ============================================================================
-- vb_platform
-- ============================================================================

-- One row per landlord-owned or managed property (a complex, block, or
-- estate in the ordinary sense — not a South African "deceased estate").
create table vb_platform.estates (
  id text primary key,
  name text not null,
  address text,
  contact_email text,
  contact_phone text,
  created_at timestamptz not null default now()
);

create table vb_platform.units (
  id text primary key,
  estate_id text not null references vb_platform.estates(id),
  unit_number text not null,
  created_at timestamptz not null default now(),
  unique (estate_id, unit_number)
);
create index on vb_platform.units (estate_id);

-- Platform identities. Every row here is linked to a Supabase Auth user via
-- auth_user_id once provisioned (mirrors the municipal platform's
-- platform.users.auth_user_id pattern in db/010 of that project) — tenants
-- via the invite/activation flow (Section 3.3 of the spec), staff roles
-- provisioned directly by SysAdmin/IT Admin (no self-signup for anyone).
create table vb_platform.users (
  id text primary key,
  email text not null unique,
  name text not null,
  auth_user_id uuid unique,
  -- tenant | sysadmin | data_admin | data_analyst | compliance_officer | landlord | estate_manager | it_admin
  role text not null,
  created_at timestamptz not null default now()
);

-- A tenant's current unit — set on activation (Section 3.3 step 4), null
-- until then. "One tenant, one unit, one lease at a time" per the spec;
-- historical leases stay in vb_platform.leases regardless of which one a
-- tenant is currently scoped to.
alter table vb_platform.users add column tenant_unit_id text references vb_platform.units(id);
create index on vb_platform.users (tenant_unit_id) where tenant_unit_id is not null;

-- A landlord may own several estates/units; an estate manager may manage
-- several estates. Both are many-to-many, unlike a tenant's single unit.
create table vb_platform.landlord_estates (
  user_id text not null references vb_platform.users(id),
  estate_id text not null references vb_platform.estates(id),
  primary key (user_id, estate_id)
);
create index on vb_platform.landlord_estates (estate_id);

create table vb_platform.estate_manager_estates (
  user_id text not null references vb_platform.users(id),
  estate_id text not null references vb_platform.estates(id),
  primary key (user_id, estate_id)
);
create index on vb_platform.estate_manager_estates (estate_id);

create table vb_platform.leases (
  id text primary key,
  unit_id text not null references vb_platform.units(id),
  tenant_user_id text references vb_platform.users(id),
  rent_amount numeric not null,
  start_date date not null,
  end_date date,
  status text not null default 'active', -- active | ended
  created_at timestamptz not null default now()
);
create index on vb_platform.leases (unit_id);
create index on vb_platform.leases (tenant_user_id) where tenant_user_id is not null;

-- The access-provisioning chain from Section 3.3: an estate manager or
-- landlord "invites" a tenant against a unit (step 1-2), xLayer creates the
-- access grant + sends this row's token as an activation link (step 3), the
-- tenant activates (step 4) which links vb_platform.users.tenant_unit_id
-- and flips status here to 'activated'.
create table vb_platform.tenant_invites (
  id text primary key,
  unit_id text not null references vb_platform.units(id),
  lease_id text not null references vb_platform.leases(id),
  email text not null,
  token text not null unique,
  invited_by text not null references vb_platform.users(id),
  status text not null default 'pending', -- pending | activated | expired
  created_at timestamptz not null default now(),
  activated_at timestamptz
);
create index on vb_platform.tenant_invites (unit_id);
create index on vb_platform.tenant_invites (lease_id);

-- ============================================================================
-- vb_metering
-- ============================================================================

-- One approved tariff schedule per code, effective-dated the same way the
-- municipal platform's billing.tariffs is — a rate change never rewrites
-- what a past invoice was actually billed at.
create table vb_metering.tariffs (
  id bigint generated always as identity primary key,
  code text not null,
  description text not null,
  water_per_kl numeric not null default 0,
  electricity_per_kwh numeric not null default 0,
  vat_rate numeric not null default 0.15,
  valid_from date not null,
  valid_to date
);
create index on vb_metering.tariffs (code, valid_from);

create table vb_metering.meters (
  id text primary key,
  unit_id text not null references vb_platform.units(id),
  type text not null, -- water | prepaid_electricity | metered_electricity
  serial text not null unique,
  last_reading numeric not null default 0,
  last_reading_at timestamptz not null default now(),
  status text not null default 'normal' -- normal | fault
);
create index on vb_metering.meters (unit_id);

create table vb_metering.readings (
  id bigint generated always as identity primary key,
  meter_id text not null references vb_metering.meters(id),
  reading numeric not null,
  read_at timestamptz not null default now()
);
create index on vb_metering.readings (meter_id);

create table vb_metering.prepaid_tokens (
  id text primary key,
  meter_id text not null references vb_metering.meters(id),
  unit_id text not null references vb_platform.units(id),
  amount numeric not null,
  units numeric not null,
  token text not null,
  vended_at timestamptz not null default now()
);
create index on vb_metering.prepaid_tokens (unit_id);
create index on vb_metering.prepaid_tokens (meter_id);

-- Minimal loadshedding schedule — "Meter management and load management,
-- including loadshedding schedule handling" (Section 4.1). One row per
-- estate/stage/window; not modelled as a full calendaring system.
create table vb_metering.loadshedding_schedules (
  id bigint generated always as identity primary key,
  estate_id text not null references vb_platform.estates(id),
  stage integer not null,
  day_of_week integer not null, -- 0=Sunday .. 6=Saturday
  start_time time not null,
  end_time time not null
);
create index on vb_metering.loadshedding_schedules (estate_id);

-- ============================================================================
-- vb_billing
-- ============================================================================

-- One consolidated statement per unit per period — rent, levies, water,
-- and metered electricity all as line items on the same invoice (Section
-- 3.1: "a single consolidated statement... rather than separate bills").
-- Prepaid electricity is a wallet top-up (vb_metering.prepaid_tokens), not
-- an invoice line, mirroring how the municipal platform excludes prepaid
-- electricity from statements too.
create table vb_billing.invoices (
  id text primary key,
  unit_id text not null references vb_platform.units(id),
  lease_id text not null references vb_platform.leases(id),
  billing_period text not null, -- YYYY-MM
  issue_date date not null,
  due_date date not null,
  total_amount numeric not null default 0,
  amount_paid numeric not null default 0,
  status text not null default 'pending', -- pending | paid | overdue | disputed
  created_at timestamptz not null default now(),
  unique (unit_id, billing_period)
);
create index on vb_billing.invoices (lease_id);

create table vb_billing.invoice_lines (
  id bigint generated always as identity primary key,
  invoice_id text not null references vb_billing.invoices(id) on delete cascade,
  category text not null, -- rent | levy | charge | water | electricity | other
  description text not null,
  quantity numeric not null default 1,
  unit_price numeric not null,
  amount numeric not null
);
create index on vb_billing.invoice_lines (invoice_id);

create table vb_billing.credit_notes (
  id text primary key,
  invoice_id text not null references vb_billing.invoices(id),
  amount numeric not null,
  reason text not null,
  issued_by text not null references vb_platform.users(id),
  created_at timestamptz not null default now()
);
create index on vb_billing.credit_notes (invoice_id);

create table vb_billing.disputes (
  id text primary key,
  invoice_id text not null references vb_billing.invoices(id),
  unit_id text not null references vb_platform.units(id),
  reason text not null,
  description text not null,
  status text not null default 'open', -- open | under_review | resolved | rejected
  resolution_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index on vb_billing.disputes (invoice_id);
create index on vb_billing.disputes (unit_id);

create table vb_billing.dunning_log (
  id bigint generated always as identity primary key,
  invoice_id text not null references vb_billing.invoices(id),
  unit_id text not null references vb_platform.units(id),
  channel text not null, -- email | sms
  message text not null,
  sent_at timestamptz not null default now()
);
create index on vb_billing.dunning_log (invoice_id);

-- Payment collection is BipraPay.com only (Section 3.1/3.4) — no
-- multi-gateway routing the way the municipal platform has.
create table vb_billing.payment_transactions (
  ref text primary key,
  unit_id text not null references vb_platform.units(id),
  invoice_id text references vb_billing.invoices(id),
  amount numeric not null,
  method text not null, -- eft | card | debit_order
  status text not null, -- matched | suspense | failed
  erp_status text not null default 'pending', -- pending | posted (MORR ERP)
  created_at timestamptz not null default now()
);
create index on vb_billing.payment_transactions (unit_id);
create index on vb_billing.payment_transactions (invoice_id) where invoice_id is not null;

-- ============================================================================
-- vb_ops
-- ============================================================================

-- Kanban-backed arrears pipeline (Section 4.2): stage is the column a case
-- currently sits in; vb_ops.arrears_case_history is the per-stage audit
-- trail the spec calls out explicitly ("a case's path through the pipeline
-- stays auditable").
create table vb_ops.arrears_cases (
  id text primary key,
  unit_id text not null references vb_platform.units(id),
  invoice_id text references vb_billing.invoices(id),
  stage text not null default 'open', -- open | contacted | payment_plan | legal_escalation | resolved | written_off
  assigned_to text references vb_platform.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on vb_ops.arrears_cases (unit_id);
create index on vb_ops.arrears_cases (assigned_to) where assigned_to is not null;

create table vb_ops.arrears_case_history (
  id bigint generated always as identity primary key,
  case_id text not null references vb_ops.arrears_cases(id),
  from_stage text,
  to_stage text not null,
  actor text not null,
  note text,
  created_at timestamptz not null default now()
);
create index on vb_ops.arrears_case_history (case_id);

create table vb_ops.legal_escalations (
  id text primary key,
  case_id text not null references vb_ops.arrears_cases(id),
  status text not null default 'referred', -- referred | in_progress | judgment | resolved
  notes text,
  created_at timestamptz not null default now()
);
create index on vb_ops.legal_escalations (case_id);

create table vb_ops.payment_plans (
  id text primary key,
  unit_id text not null references vb_platform.units(id),
  invoice_id text references vb_billing.invoices(id),
  total_amount numeric not null,
  installments integer not null,
  installment_amount numeric not null,
  start_date date not null,
  status text not null default 'active', -- active | completed | cancelled
  created_at timestamptz not null default now()
);
create index on vb_ops.payment_plans (unit_id);

-- The white-label statement template an estate manager edits in the
-- contenteditable editor (Section 4.2). Null estate_id = platform default.
create table vb_ops.statement_templates (
  id text primary key,
  estate_id text references vb_platform.estates(id),
  name text not null,
  html_content text not null,
  updated_by text not null references vb_platform.users(id),
  updated_at timestamptz not null default now()
);
create index on vb_ops.statement_templates (estate_id) where estate_id is not null;

-- ============================================================================
-- vb_events (xLayer)
-- ============================================================================

-- Append-only event log xBilling and xUtilities both write to and read
-- from (Section 5.1). Every mutating RPC in db/012 appends here, the same
-- way the municipal platform's compliance.audit_events works, but this one
-- is a plain event log rather than a hash chain — the spec describes it as
-- an audit/replay log for cross-module triggers, not a tamper-evidence
-- mechanism.
create table vb_events.event_log (
  id bigint generated always as identity primary key,
  event_type text not null, -- e.g. 'tenant.invited', 'invoice.issued', 'payment.settled'
  source text not null, -- xbilling | xutilities | xlayer
  actor text,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on vb_events.event_log (event_type);
create index on vb_events.event_log (created_at);

create table vb_events.webhook_endpoints (
  id text primary key,
  name text not null,
  url text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table vb_events.webhook_deliveries (
  id bigint generated always as identity primary key,
  event_id bigint not null references vb_events.event_log(id),
  endpoint_id text not null references vb_events.webhook_endpoints(id),
  status text not null default 'pending', -- pending | delivered | failed
  response_code integer,
  error text,
  attempted_at timestamptz
);
create index on vb_events.webhook_deliveries (event_id);
create index on vb_events.webhook_deliveries (endpoint_id);
