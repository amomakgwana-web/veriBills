-- veriBills :: 004 prepaid electricity, usage monitoring, maintenance,
--                  gate access codes and shared facilities

-- ---------------------------------------------------------------------------
-- Prepaid electricity
-- ---------------------------------------------------------------------------

create table token_vendors (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references organisations(id) on delete cascade,
  key               text not null,           -- 'eskom', 'mock', partner keys
  name              text not null,
  is_default        boolean not null default false,
  is_active         boolean not null default true,
  -- Non-secret config only. Credentials live in the platform secret store and
  -- are referenced by name.
  config            jsonb not null default '{}'::jsonb,
  credential_ref    text,
  created_at        timestamptz not null default now(),
  unique (org_id, key)
);

create table electricity_purchases (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  unit_id           uuid not null references units(id) on delete cascade,
  meter_id          uuid not null references meters(id) on delete restrict,
  profile_id        uuid not null references profiles(id) on delete restrict,
  payment_id        uuid references payments(id) on delete set null,
  vendor_id         uuid references token_vendors(id) on delete set null,
  reference         text not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'paid', 'token_issued', 'delivered', 'failed', 'refunded')),
  -- Money in
  gross_amount      numeric(14,2) not null check (gross_amount > 0),
  vat_amount        numeric(14,2) not null default 0,
  service_fee       numeric(14,2) not null default 0,
  -- What that money bought
  units_kwh         numeric(14,3),
  rate_per_kwh      numeric(14,6),
  tariff_id         uuid references tariffs(id) on delete set null,
  -- Arrears recovery: estates commonly claw back debt off each purchase.
  debt_recovered    numeric(14,2) not null default 0 check (debt_recovered >= 0),
  -- The 20-digit STS token handed to the tenant.
  token             text,
  token_type        text default 'credit' check (token_type in ('credit', 'key_change', 'clear_tamper', 'clear_credit')),
  vendor_reference  text,
  issued_at         timestamptz,
  delivered_at      timestamptz,
  delivery_channel  channel,
  failure_reason    text,
  receipt_sent_at   timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, reference)
);

create index on electricity_purchases (unit_id, created_at desc);
create index on electricity_purchases (profile_id, created_at desc);
create index on electricity_purchases (org_id, status, created_at desc);

-- ---------------------------------------------------------------------------
-- Usage monitoring engine
-- ---------------------------------------------------------------------------

-- Rolling per-unit consumption stats, recalculated as readings arrive.
-- Used to spot leaks, tampering and runaway usage.
create table usage_baselines (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  unit_id           uuid not null references units(id) on delete cascade,
  meter_id          uuid not null references meters(id) on delete cascade,
  utility           meter_type not null,
  period_days       int not null default 30,
  mean_consumption  numeric(14,3) not null default 0,
  stddev_consumption numeric(14,3) not null default 0,
  peak_consumption  numeric(14,3) not null default 0,
  sample_count      int not null default 0,
  computed_at       timestamptz not null default now(),
  unique (meter_id, period_days)
);

create table usage_alerts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  unit_id           uuid not null references units(id) on delete cascade,
  meter_id          uuid references meters(id) on delete set null,
  utility           meter_type not null,
  severity          alert_severity not null default 'warning',
  rule              text not null,   -- 'spike', 'continuous_flow', 'zero_usage', 'threshold', 'tamper'
  title             text not null,
  detail            text,
  observed_value    numeric(14,3),
  expected_value    numeric(14,3),
  deviation_percent numeric(10,2),
  period_start      timestamptz,
  period_end        timestamptz,
  is_acknowledged   boolean not null default false,
  acknowledged_by   uuid references profiles(id) on delete set null,
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  maintenance_request_id uuid,  -- FK added below
  created_at        timestamptz not null default now()
);

create index on usage_alerts (org_id, is_acknowledged, created_at desc);
create index on usage_alerts (unit_id, created_at desc);

-- Per-org thresholds driving the alert rules above.
create table usage_rules (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid references properties(id) on delete cascade,
  utility           meter_type not null,
  rule              text not null,
  is_active         boolean not null default true,
  -- Percentage above baseline that trips a 'spike'.
  spike_percent     numeric(10,2) default 50,
  -- Absolute ceiling per billing period.
  absolute_threshold numeric(14,3),
  -- Minimum consumption over a window that suggests a leak/continuous flow.
  continuous_min    numeric(14,3),
  window_hours      int default 24,
  severity          alert_severity not null default 'warning',
  notify_tenant     boolean not null default true,
  notify_staff      boolean not null default true,
  created_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------------

create table contractors (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  name              text not null,
  trade             text,
  contact_name      text,
  phone             text,
  email             citext,
  hourly_rate       numeric(14,2),
  is_active         boolean not null default true,
  rating            numeric(3,2) check (rating between 0 and 5),
  created_at        timestamptz not null default now()
);

create table maintenance_requests (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid not null references properties(id) on delete cascade,
  unit_id           uuid references units(id) on delete set null,
  lease_id          uuid references leases(id) on delete set null,
  reported_by       uuid references profiles(id) on delete set null,
  reference         text not null,
  category          text not null,   -- plumbing, electrical, structural, appliance, common_area...
  priority          maintenance_priority not null default 'normal',
  status            maintenance_status not null default 'logged',
  title             text not null,
  description       text not null,
  location_detail   text,
  photo_urls        text[] not null default '{}',
  access_instructions text,
  permission_to_enter boolean not null default false,
  assigned_to       uuid references profiles(id) on delete set null,
  contractor_id     uuid references contractors(id) on delete set null,
  scheduled_for     timestamptz,
  acknowledged_at   timestamptz,
  resolved_at       timestamptz,
  closed_at         timestamptz,
  resolution_notes  text,
  -- Cost handling: some repairs are recharged to the tenant.
  estimated_cost    numeric(14,2),
  actual_cost       numeric(14,2),
  is_tenant_liable  boolean not null default false,
  recharged_invoice_id uuid references invoices(id) on delete set null,
  satisfaction_rating int check (satisfaction_rating between 1 and 5),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, reference)
);

create index on maintenance_requests (org_id, status, priority);
create index on maintenance_requests (unit_id, created_at desc);
create index on maintenance_requests (assigned_to) where status not in ('closed', 'resolved');

alter table usage_alerts
  add constraint usage_alerts_maintenance_fk
  foreign key (maintenance_request_id) references maintenance_requests(id) on delete set null;

create table maintenance_comments (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references maintenance_requests(id) on delete cascade,
  author_id         uuid references profiles(id) on delete set null,
  body              text not null,
  -- Internal notes stay hidden from the tenant.
  is_internal       boolean not null default false,
  attachment_urls   text[] not null default '{}',
  created_at        timestamptz not null default now()
);

create index on maintenance_comments (request_id, created_at);

create table maintenance_status_history (
  id                uuid primary key default gen_random_uuid(),
  request_id        uuid not null references maintenance_requests(id) on delete cascade,
  from_status       maintenance_status,
  to_status         maintenance_status not null,
  changed_by        uuid references profiles(id) on delete set null,
  note              text,
  changed_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Gate access codes
-- ---------------------------------------------------------------------------

create table access_codes (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid not null references properties(id) on delete cascade,
  unit_id           uuid references units(id) on delete cascade,
  issued_by         uuid not null references profiles(id) on delete cascade,
  code              text not null,
  type              access_code_type not null default 'visitor',
  status            access_code_status not null default 'active',
  visitor_name      text,
  visitor_phone     text,
  vehicle_registration text,
  purpose           text,
  valid_from        timestamptz not null default now(),
  valid_until       timestamptz not null,
  max_uses          int not null default 1 check (max_uses > 0),
  use_count         int not null default 0 check (use_count >= 0),
  revoked_at        timestamptz,
  revoked_by        uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  check (valid_until > valid_from)
);

-- Codes are only unique among those still live at a property.
create unique index access_codes_live_unique
  on access_codes (property_id, code) where status = 'active';
create index on access_codes (unit_id, created_at desc);
create index on access_codes (org_id, status);

create table access_events (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid not null references properties(id) on delete cascade,
  access_code_id    uuid references access_codes(id) on delete set null,
  profile_id        uuid references profiles(id) on delete set null,
  gate              text,
  direction         text check (direction in ('entry', 'exit')),
  result            text not null default 'granted'
                    check (result in ('granted', 'denied_expired', 'denied_revoked', 'denied_exhausted', 'denied_unknown', 'denied_no_access')),
  scanned_code      text,
  occurred_at       timestamptz not null default now(),
  metadata          jsonb not null default '{}'::jsonb
);

create index on access_events (property_id, occurred_at desc);
create index on access_events (access_code_id);

-- ---------------------------------------------------------------------------
-- Facilities: gym, clubhouse, pool, braai areas
-- ---------------------------------------------------------------------------

create table facilities (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid not null references properties(id) on delete cascade,
  name              text not null,
  kind              text not null default 'gym'
                    check (kind in ('gym', 'pool', 'clubhouse', 'braai', 'tennis', 'squash', 'coworking', 'laundry', 'other')),
  description       text,
  capacity          int,
  requires_booking  boolean not null default false,
  requires_induction boolean not null default false,
  -- Access is withheld from tenants in arrears when true.
  requires_good_standing boolean not null default true,
  booking_fee       numeric(14,2) not null default 0,
  opens_at          time not null default '05:00',
  closes_at         time not null default '22:00',
  max_booking_minutes int not null default 60,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

-- A tenant's standing access right to a facility (gym membership, fob).
create table facility_access_grants (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  facility_id       uuid not null references facilities(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  lease_id          uuid references leases(id) on delete cascade,
  status            text not null default 'active'
                    check (status in ('active', 'suspended', 'revoked', 'pending_induction')),
  access_tag        text,          -- fob/biometric identifier
  induction_completed_at timestamptz,
  waiver_signed_at  timestamptz,
  suspended_reason  text,
  valid_from        date not null default current_date,
  valid_until       date,
  created_at        timestamptz not null default now(),
  unique (facility_id, profile_id)
);

create index on facility_access_grants (profile_id, status);

create table facility_bookings (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  facility_id       uuid not null references facilities(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  unit_id           uuid references units(id) on delete set null,
  status            facility_booking_status not null default 'requested',
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  guest_count       int not null default 0 check (guest_count >= 0),
  fee_amount        numeric(14,2) not null default 0,
  payment_id        uuid references payments(id) on delete set null,
  notes             text,
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index on facility_bookings (facility_id, starts_at);
create index on facility_bookings (profile_id, starts_at desc);

create table facility_access_events (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  facility_id       uuid not null references facilities(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete set null,
  grant_id          uuid references facility_access_grants(id) on delete set null,
  result            text not null default 'granted'
                    check (result in ('granted', 'denied_arrears', 'denied_no_grant', 'denied_suspended', 'denied_closed', 'denied_capacity')),
  occurred_at       timestamptz not null default now()
);

create index on facility_access_events (facility_id, occurred_at desc);

create trigger electricity_purchases_updated_at before update on electricity_purchases
  for each row execute function set_updated_at();
create trigger maintenance_requests_updated_at before update on maintenance_requests
  for each row execute function set_updated_at();
