-- veriBills :: 001 core foundations
-- Extensions, shared enums, organisations, user profiles, org membership.

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

create type org_role as enum (
  'owner',       -- estate/landlord entity owner
  'admin',       -- full management rights within the org
  'manager',     -- day to day property management
  'finance',     -- billing, collections, reconciliation
  'maintenance', -- maintenance queue only
  'viewer'       -- read only
);

create type property_type as enum ('residential_estate', 'apartment_block', 'office_park', 'retail_centre', 'mixed_use');

create type unit_type as enum ('apartment', 'house', 'townhouse', 'office', 'retail_store', 'storage', 'parking_bay');

create type unit_status as enum ('available', 'occupied', 'reserved', 'maintenance', 'decommissioned');

create type lease_status as enum ('draft', 'pending_signature', 'active', 'expiring', 'expired', 'terminated', 'cancelled');

create type charge_type as enum (
  'rent', 'levy', 'water', 'electricity', 'maintenance', 'refuse', 'security',
  'parking', 'deposit', 'interest', 'penalty', 'admin_fee', 'reconnection', 'other'
);

create type charge_frequency as enum ('once_off', 'monthly', 'quarterly', 'annually');

create type invoice_status as enum ('draft', 'issued', 'part_paid', 'paid', 'overdue', 'written_off', 'cancelled');

create type payment_method as enum ('card', 'eft', 'debit_order', 'debicheck', 'cash', 'instant_eft', 'wallet', 'adjustment');

create type payment_status as enum ('initiated', 'requires_3ds', 'authorised', 'captured', 'settled', 'failed', 'reversed', 'refunded');

create type ledger_direction as enum ('debit', 'credit');

create type mandate_status as enum ('draft', 'pending_authentication', 'authenticated', 'active', 'suspended', 'cancelled', 'rejected', 'expired');

create type collection_status as enum ('scheduled', 'submitted', 'successful', 'failed', 'disputed', 'reversed');

create type payment_plan_status as enum ('proposed', 'awaiting_acceptance', 'active', 'completed', 'defaulted', 'cancelled');

create type meter_type as enum ('electricity_prepaid', 'electricity_conventional', 'water', 'gas', 'heat');

create type reading_source as enum ('manual', 'ami_push', 'ami_poll', 'tenant_submitted', 'estimate');

create type maintenance_status as enum ('logged', 'acknowledged', 'assigned', 'in_progress', 'on_hold', 'resolved', 'closed', 'rejected');

create type maintenance_priority as enum ('low', 'normal', 'high', 'emergency');

create type access_code_type as enum ('visitor', 'delivery', 'contractor', 'resident', 'once_off_event');

create type access_code_status as enum ('active', 'used', 'expired', 'revoked');

create type facility_booking_status as enum ('requested', 'confirmed', 'cancelled', 'no_show', 'completed');

create type document_type as enum (
  'signed_lease', 'unsigned_lease', 'estate_policy', 'house_rules', 'id_copy',
  'payslip', 'bank_statement', 'proof_of_address', 'invoice_pdf', 'statement_pdf',
  'inspection_report', 'notice', 'other'
);

create type approval_type as enum (
  'large_payment', 'bank_account_change', 'user_deletion', 'unit_application',
  'lease_termination', 'payment_plan', 'refund', 'write_off', 'bulk_campaign'
);

create type approval_status as enum ('pending', 'approved', 'rejected', 'cancelled', 'expired');

create type application_status as enum ('submitted', 'screening', 'documents_requested', 'approved', 'declined', 'withdrawn');

create type channel as enum ('email', 'sms', 'push', 'whatsapp');

create type delivery_status as enum ('queued', 'sending', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed', 'unsubscribed');

create type campaign_status as enum ('draft', 'scheduled', 'sending', 'sent', 'paused', 'cancelled');

create type integration_kind as enum ('payment_gateway', 'sms_gateway', 'email_gateway', 'meter_vendor', 'token_vendor', 'accounting', 'bank_feed', 'identity_verification');

create type integration_status as enum ('not_configured', 'healthy', 'degraded', 'down', 'disabled');

create type alert_severity as enum ('info', 'warning', 'critical');

-- ---------------------------------------------------------------------------
-- Organisations (an estate group / landlord entity / managing agent)
-- ---------------------------------------------------------------------------

create table organisations (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  trading_name      text,
  slug              citext not null unique,
  registration_no   text,
  vat_number        text,
  billing_email     citext,
  support_email     citext,
  support_phone     text,
  address_line1     text,
  address_line2     text,
  city              text,
  province          text,
  postal_code       text,
  country_code      char(2) not null default 'ZA',
  timezone          text not null default 'Africa/Johannesburg',
  currency_code     char(3) not null default 'ZAR',
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table organisations is 'Top level tenant of the platform: an estate group, landlord entity or managing agent.';

-- White-label branding used on statements, letterheads, emails and the portal.
create table org_branding (
  org_id            uuid primary key references organisations(id) on delete cascade,
  logo_url          text,
  logo_dark_url     text,
  favicon_url       text,
  primary_color     text not null default '#0f766e',
  accent_color      text not null default '#14b8a6',
  font_family       text not null default 'Inter',
  base_font_size_px int not null default 14 check (base_font_size_px between 8 and 24),
  letterhead_html   text,
  email_header_html text,
  email_footer_html text,
  statement_footer  text,
  postal_address    text,
  portal_domain     citext,
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

create table profiles (
  id                uuid primary key references auth.users(id) on delete cascade,
  email             citext not null,
  full_name         text,
  preferred_name    text,
  phone             text,
  alt_phone         text,
  id_number         text,          -- SA ID number / passport
  id_type           text default 'sa_id' check (id_type in ('sa_id', 'passport', 'permit')),
  date_of_birth     date,
  avatar_url        text,
  postal_address    text,
  emergency_contact_name  text,
  emergency_contact_phone text,
  is_system_admin   boolean not null default false,
  marketing_opt_in  boolean not null default false,
  notify_email      boolean not null default true,
  notify_sms        boolean not null default true,
  last_seen_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on column profiles.is_system_admin is 'Platform operator. Bypasses org scoping in RLS.';

-- Tokenised card details. Never store a PAN: only the gateway token + display data.
create table payment_methods (
  id                uuid primary key default gen_random_uuid(),
  profile_id        uuid not null references profiles(id) on delete cascade,
  method            payment_method not null default 'card',
  gateway           text not null,
  gateway_token     text not null,
  brand             text,               -- visa / mastercard
  last4             char(4),
  expiry_month      int check (expiry_month between 1 and 12),
  expiry_year       int,
  holder_name       text,
  bank_name         text,
  account_last4     char(4),
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  unique (gateway, gateway_token)
);

comment on table payment_methods is 'Tokenised instruments only. PANs and CVVs never touch this database.';

create table org_members (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  role              org_role not null default 'viewer',
  job_title         text,
  is_active         boolean not null default true,
  invited_by        uuid references profiles(id),
  invited_at        timestamptz,
  accepted_at       timestamptz,
  created_at        timestamptz not null default now(),
  unique (org_id, profile_id)
);

create index on org_members (profile_id) where is_active;
create index on org_members (org_id) where is_active;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger organisations_updated_at before update on organisations
  for each row execute function set_updated_at();
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();
create trigger org_branding_updated_at before update on org_branding
  for each row execute function set_updated_at();

-- Mirror new auth users into profiles.
create or replace function handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'phone', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_auth_user();
