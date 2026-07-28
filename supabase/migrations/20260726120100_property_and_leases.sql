-- veriBills :: 002 property portfolio, metering, tariffs, leases and documents

-- ---------------------------------------------------------------------------
-- Properties and units
-- ---------------------------------------------------------------------------

create table properties (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  name              text not null,
  code              text,
  type              property_type not null default 'residential_estate',
  address_line1     text,
  address_line2     text,
  city              text,
  province          text,
  postal_code       text,
  latitude          numeric(9,6),
  longitude         numeric(9,6),
  gate_count        int not null default 1,
  has_gym           boolean not null default false,
  bank_account_id   uuid,  -- FK added in 005 once bank_accounts exists
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, code)
);

create index on properties (org_id) where is_active;

create table units (
  id                uuid primary key default gen_random_uuid(),
  property_id       uuid not null references properties(id) on delete cascade,
  org_id            uuid not null references organisations(id) on delete cascade,
  unit_number       text not null,
  type              unit_type not null default 'apartment',
  status            unit_status not null default 'available',
  floor             text,
  block             text,
  bedrooms          int,
  bathrooms         numeric(3,1),
  size_sqm          numeric(10,2),
  parking_bays      int not null default 0,
  -- Default charge configuration; a lease may override these.
  base_rent         numeric(14,2) not null default 0 check (base_rent >= 0),
  levy_amount       numeric(14,2) not null default 0 check (levy_amount >= 0),
  refuse_amount     numeric(14,2) not null default 0 check (refuse_amount >= 0),
  security_amount   numeric(14,2) not null default 0 check (security_amount >= 0),
  deposit_amount    numeric(14,2) not null default 0 check (deposit_amount >= 0),
  water_tariff_id   uuid,   -- FK added below once tariffs exists
  electricity_tariff_id uuid,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (property_id, unit_number)
);

create index on units (org_id);
create index on units (property_id, status);

-- ---------------------------------------------------------------------------
-- Tariffs (stepped/block rates for water and electricity)
-- ---------------------------------------------------------------------------

create table tariffs (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  name              text not null,
  utility           meter_type not null,
  -- Fixed monthly availability/basic charge levied regardless of consumption.
  fixed_charge      numeric(14,2) not null default 0 check (fixed_charge >= 0),
  vat_rate          numeric(5,4) not null default 0.15 check (vat_rate >= 0 and vat_rate < 1),
  -- Margin the estate adds on top of the bulk supplier rate.
  markup_percent    numeric(6,3) not null default 0 check (markup_percent >= 0),
  effective_from    date not null default current_date,
  effective_to      date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  check (effective_to is null or effective_to > effective_from)
);

create index on tariffs (org_id, utility) where is_active;

-- Stepped blocks: block_from_units is inclusive, block_to_units exclusive/null = infinity.
create table tariff_blocks (
  id                uuid primary key default gen_random_uuid(),
  tariff_id         uuid not null references tariffs(id) on delete cascade,
  sequence          int not null,
  block_from_units  numeric(14,3) not null default 0 check (block_from_units >= 0),
  block_to_units    numeric(14,3),
  rate_per_unit     numeric(14,6) not null check (rate_per_unit >= 0),
  unique (tariff_id, sequence),
  check (block_to_units is null or block_to_units > block_from_units)
);

alter table units
  add constraint units_water_tariff_fk foreign key (water_tariff_id) references tariffs(id) on delete set null,
  add constraint units_electricity_tariff_fk foreign key (electricity_tariff_id) references tariffs(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Meters and readings
-- ---------------------------------------------------------------------------

create table meters (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  unit_id           uuid references units(id) on delete set null,
  property_id       uuid not null references properties(id) on delete cascade,
  meter_number      text not null,
  serial_number     text,
  type              meter_type not null,
  tariff_id         uuid references tariffs(id) on delete set null,
  vendor            text,                 -- AMI/meter vendor key, see integrations
  is_bulk           boolean not null default false,
  multiplier        numeric(10,4) not null default 1 check (multiplier > 0),
  last_reading      numeric(14,3),
  last_reading_at   timestamptz,
  installed_on      date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, meter_number)
);

create index on meters (unit_id) where is_active;
create index on meters (property_id, type);

create table meter_readings (
  id                uuid primary key default gen_random_uuid(),
  meter_id          uuid not null references meters(id) on delete cascade,
  org_id            uuid not null references organisations(id) on delete cascade,
  reading           numeric(14,3) not null check (reading >= 0),
  -- Consumption since the previous reading, computed on insert.
  consumption       numeric(14,3),
  read_at           timestamptz not null default now(),
  source            reading_source not null default 'manual',
  read_by           uuid references profiles(id) on delete set null,
  photo_url         text,
  is_estimate       boolean not null default false,
  notes             text,
  created_at        timestamptz not null default now()
);

create index on meter_readings (meter_id, read_at desc);
create index on meter_readings (org_id, read_at desc);

-- ---------------------------------------------------------------------------
-- Leases
-- ---------------------------------------------------------------------------

create table leases (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  unit_id           uuid not null references units(id) on delete restrict,
  reference         text not null,
  status            lease_status not null default 'draft',
  start_date        date not null,
  end_date          date,
  -- Contracted amounts; fall back to the unit defaults when null.
  monthly_rent      numeric(14,2) not null check (monthly_rent >= 0),
  monthly_levy      numeric(14,2) not null default 0 check (monthly_levy >= 0),
  deposit_amount    numeric(14,2) not null default 0 check (deposit_amount >= 0),
  deposit_held      numeric(14,2) not null default 0 check (deposit_held >= 0),
  escalation_percent numeric(6,3) not null default 0 check (escalation_percent >= 0),
  escalation_month  int check (escalation_month between 1 and 12),
  billing_day       int not null default 1 check (billing_day between 1 and 28),
  due_day           int not null default 7 check (due_day between 1 and 28),
  grace_days        int not null default 0 check (grace_days >= 0),
  interest_rate_annual numeric(6,3) not null default 0 check (interest_rate_annual >= 0),
  signed_at         timestamptz,
  terminated_at     timestamptz,
  termination_reason text,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, reference),
  check (end_date is null or end_date > start_date)
);

create index on leases (unit_id, status);
create index on leases (org_id, status);

-- A lease can carry several tenants (co-signers, spouse, company signatory).
create table lease_tenants (
  id                uuid primary key default gen_random_uuid(),
  lease_id          uuid not null references leases(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  is_primary        boolean not null default false,
  -- Share of the bill this tenant is liable for; primary carries the remainder.
  liability_percent numeric(5,2) not null default 100 check (liability_percent > 0 and liability_percent <= 100),
  moved_in_at       date,
  moved_out_at      date,
  created_at        timestamptz not null default now(),
  unique (lease_id, profile_id)
);

create index on lease_tenants (profile_id);
-- Exactly one primary tenant per lease.
create unique index lease_tenants_one_primary on lease_tenants (lease_id) where is_primary;

-- Per-lease recurring charge lines, driving the monthly billing run.
create table lease_charges (
  id                uuid primary key default gen_random_uuid(),
  lease_id          uuid not null references leases(id) on delete cascade,
  org_id            uuid not null references organisations(id) on delete cascade,
  type              charge_type not null,
  description       text not null,
  amount            numeric(14,2) not null check (amount >= 0),
  frequency         charge_frequency not null default 'monthly',
  vat_rate          numeric(5,4) not null default 0 check (vat_rate >= 0 and vat_rate < 1),
  -- Metered charges are calculated from consumption rather than a flat amount.
  is_metered        boolean not null default false,
  start_date        date not null default current_date,
  end_date          date,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now()
);

create index on lease_charges (lease_id) where is_active;

-- ---------------------------------------------------------------------------
-- Documents (leases, policies, tenant supporting docs)
-- ---------------------------------------------------------------------------

create table documents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid references properties(id) on delete cascade,
  unit_id           uuid references units(id) on delete cascade,
  lease_id          uuid references leases(id) on delete cascade,
  profile_id        uuid references profiles(id) on delete cascade,
  type              document_type not null,
  title             text not null,
  description       text,
  storage_path      text not null,
  mime_type         text,
  size_bytes        bigint,
  -- Visible to the tenants it relates to; otherwise staff-only.
  tenant_visible    boolean not null default false,
  requires_acknowledgement boolean not null default false,
  version           int not null default 1,
  uploaded_by       uuid references profiles(id) on delete set null,
  published_at      timestamptz,
  expires_at        timestamptz,
  created_at        timestamptz not null default now()
);

create index on documents (org_id, type);
create index on documents (lease_id) where lease_id is not null;
create index on documents (profile_id) where profile_id is not null;

create table document_acknowledgements (
  id                uuid primary key default gen_random_uuid(),
  document_id       uuid not null references documents(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  acknowledged_at   timestamptz not null default now(),
  ip_address        inet,
  user_agent        text,
  signature_name    text,
  unique (document_id, profile_id)
);

create trigger properties_updated_at before update on properties
  for each row execute function set_updated_at();
create trigger units_updated_at before update on units
  for each row execute function set_updated_at();
create trigger meters_updated_at before update on meters
  for each row execute function set_updated_at();
create trigger leases_updated_at before update on leases
  for each row execute function set_updated_at();
