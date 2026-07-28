-- veriBills :: 005 announcements, bulk campaigns, notification trails,
--                  applications, approvals, audit, integrations, chatbot

-- ---------------------------------------------------------------------------
-- Announcements
-- ---------------------------------------------------------------------------

create table announcements (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid references properties(id) on delete cascade,
  author_id         uuid references profiles(id) on delete set null,
  title             text not null,
  body              text not null,
  category          text not null default 'general'
                    check (category in ('general', 'maintenance', 'outage', 'security', 'billing', 'event', 'emergency')),
  severity          alert_severity not null default 'info',
  is_pinned         boolean not null default false,
  -- Optional targeting; null audience means everyone at the property.
  audience_unit_types unit_type[],
  publish_at        timestamptz not null default now(),
  expires_at        timestamptz,
  attachment_urls   text[] not null default '{}',
  send_email        boolean not null default false,
  send_sms          boolean not null default false,
  published_by      uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on announcements (org_id, publish_at desc);
create index on announcements (property_id, publish_at desc);

create table announcement_reads (
  announcement_id   uuid not null references announcements(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  read_at           timestamptz not null default now(),
  primary key (announcement_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Message templates and bulk campaigns
-- ---------------------------------------------------------------------------

create table message_templates (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  key               text not null,
  name              text not null,
  channel           channel not null,
  subject           text,
  body              text not null,          -- supports {{placeholders}}
  -- Transactional templates are fired by the system, not by campaigns.
  is_transactional  boolean not null default false,
  use_letterhead    boolean not null default true,
  is_active         boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, key, channel)
);

create table campaigns (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid references properties(id) on delete cascade,
  name              text not null,
  channel           channel not null,
  status            campaign_status not null default 'draft',
  template_id       uuid references message_templates(id) on delete set null,
  subject           text,
  body              text not null,
  -- Why this batch is going out. Drives the recipient filter below.
  reason            text not null default 'general'
                    check (reason in ('general', 'bill_presentment', 'outstanding_fees', 'failed_collection',
                                      'payment_reminder', 'lease_expiry', 'policy_update', 'maintenance_notice',
                                      'meter_reading_request', 'announcement')),
  -- Declarative audience filter, e.g.
  -- {"min_balance": 1000, "unit_types": ["apartment"], "in_arrears": true}
  audience_filter   jsonb not null default '{}'::jsonb,
  recipient_count   int not null default 0,
  -- Scheduling window; sends are paced so they land in working hours.
  scheduled_for     timestamptz,
  send_window_start time,
  send_window_end   time,
  throttle_per_hour int,
  expires_at        timestamptz,
  requires_approval boolean not null default false,
  approval_id       uuid,
  -- Delivery counters, maintained as receipts arrive.
  sent_count        int not null default 0,
  delivered_count   int not null default 0,
  opened_count      int not null default 0,
  clicked_count     int not null default 0,
  failed_count      int not null default 0,
  paid_count        int not null default 0,
  created_by        uuid references profiles(id) on delete set null,
  started_at        timestamptz,
  completed_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on campaigns (org_id, status, created_at desc);

-- Unified delivery trail: both campaign sends and transactional notifications.
create table message_deliveries (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  campaign_id       uuid references campaigns(id) on delete cascade,
  template_key      text,
  profile_id        uuid references profiles(id) on delete set null,
  account_id        uuid references tenant_accounts(id) on delete set null,
  invoice_id        uuid references invoices(id) on delete set null,
  payment_id        uuid references payments(id) on delete set null,
  channel           channel not null,
  status            delivery_status not null default 'queued',
  to_address        text not null,          -- email address or MSISDN
  subject           text,
  body_preview      text,
  provider          text,
  provider_message_id text,
  -- Engagement trail
  queued_at         timestamptz not null default now(),
  sent_at           timestamptz,
  delivered_at      timestamptz,
  opened_at         timestamptz,
  clicked_at        timestamptz,
  failed_at         timestamptz,
  failure_reason    text,
  -- Attribution: did a payment follow this message?
  resulted_in_payment_id uuid references payments(id) on delete set null,
  paid_at           timestamptz,
  cost              numeric(10,4),
  segments          int,
  created_at        timestamptz not null default now()
);

create index on message_deliveries (campaign_id, status);
create index on message_deliveries (org_id, created_at desc);
create index on message_deliveries (profile_id, created_at desc);
create index on message_deliveries (provider, provider_message_id);

-- ---------------------------------------------------------------------------
-- Applications for a new unit / office / store
-- ---------------------------------------------------------------------------

create table unit_applications (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  property_id       uuid references properties(id) on delete set null,
  unit_id           uuid references units(id) on delete set null,
  applicant_id      uuid not null references profiles(id) on delete cascade,
  reference         text not null,
  status            application_status not null default 'submitted',
  requested_type    unit_type not null default 'apartment',
  desired_move_in   date,
  lease_term_months int,
  -- Affordability screening inputs
  monthly_income    numeric(14,2),
  employer          text,
  employment_type   text check (employment_type in ('permanent', 'contract', 'self_employed', 'student', 'retired', 'unemployed')),
  occupants         int,
  has_pets          boolean not null default false,
  pet_detail        text,
  is_company        boolean not null default false,
  company_name      text,
  company_reg_no    text,
  trading_type      text,
  motivation        text,
  -- Screening outputs
  credit_check_status text check (credit_check_status in ('not_run', 'pending', 'passed', 'failed', 'manual_review')),
  credit_score      int,
  affordability_ratio numeric(6,3),
  reviewed_by       uuid references profiles(id) on delete set null,
  reviewed_at       timestamptz,
  decision_reason   text,
  approval_id       uuid,
  created_lease_id  uuid references leases(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, reference)
);

create index on unit_applications (org_id, status, created_at desc);
create index on unit_applications (applicant_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Generic approval workflow
-- ---------------------------------------------------------------------------

create table approvals (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  type              approval_type not null,
  status            approval_status not null default 'pending',
  title             text not null,
  description       text,
  -- Polymorphic pointer to whatever needs approving.
  subject_table     text not null,
  subject_id        uuid not null,
  amount            numeric(14,2),
  -- Number of distinct approvers required before this passes.
  required_approvals int not null default 1 check (required_approvals > 0),
  approvals_received int not null default 0,
  requested_by      uuid references profiles(id) on delete set null,
  resolved_at       timestamptz,
  resolution_note   text,
  expires_at        timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on approvals (org_id, status, created_at desc);
create index on approvals (subject_table, subject_id);

create table approval_decisions (
  id                uuid primary key default gen_random_uuid(),
  approval_id       uuid not null references approvals(id) on delete cascade,
  decided_by        uuid not null references profiles(id) on delete cascade,
  decision          text not null check (decision in ('approved', 'rejected')),
  comment           text,
  -- Typed name acting as the signature for user-deletion requests.
  signature_name    text,
  ip_address        inet,
  decided_at        timestamptz not null default now(),
  unique (approval_id, decided_by)
);

alter table payments
  add constraint payments_approval_fk foreign key (approval_id) references approvals(id) on delete set null;
alter table campaigns
  add constraint campaigns_approval_fk foreign key (approval_id) references approvals(id) on delete set null;
alter table unit_applications
  add constraint unit_applications_approval_fk foreign key (approval_id) references approvals(id) on delete set null;

-- Thresholds that decide when an action needs approving.
create table approval_policies (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  type              approval_type not null,
  is_active         boolean not null default true,
  -- Applies when the amount meets or exceeds this. Null = always require.
  amount_threshold  numeric(14,2),
  required_approvals int not null default 1 check (required_approvals > 0),
  approver_roles    org_role[] not null default '{owner,admin}',
  created_at        timestamptz not null default now(),
  unique (org_id, type)
);

-- ---------------------------------------------------------------------------
-- Banking configuration
-- ---------------------------------------------------------------------------

create table bank_accounts (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  label             text not null,
  bank_name         text not null,
  branch_code       text not null,
  account_number_masked text not null,
  account_type      text check (account_type in ('cheque', 'savings', 'transmission')),
  account_holder    text not null,
  -- Secret material is held in the platform secret store, referenced here.
  credential_ref    text,
  is_primary        boolean not null default false,
  is_active         boolean not null default true,
  -- Changes to banking details always route through an approval.
  pending_change    jsonb,
  pending_approval_id uuid references approvals(id) on delete set null,
  verified_at       timestamptz,
  verified_by       uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on bank_accounts (org_id) where is_active;

alter table properties
  add constraint properties_bank_account_fk foreign key (bank_account_id) references bank_accounts(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Credit scoring / tenant risk
-- ---------------------------------------------------------------------------

create table tenant_scores (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  account_id        uuid references tenant_accounts(id) on delete cascade,
  -- 0-100 internal behaviour score, distinct from any bureau score.
  score             int not null check (score between 0 and 100),
  band              text not null check (band in ('excellent', 'good', 'fair', 'poor', 'high_risk')),
  on_time_payments  int not null default 0,
  late_payments     int not null default 0,
  missed_payments   int not null default 0,
  failed_collections int not null default 0,
  average_days_late numeric(8,2) not null default 0,
  months_tenancy    int not null default 0,
  current_arrears   numeric(14,2) not null default 0,
  bureau_score      int,
  bureau_checked_at timestamptz,
  computed_at       timestamptz not null default now(),
  unique (org_id, profile_id)
);

-- ---------------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------------

create table audit_logs (
  id                bigserial primary key,
  org_id            uuid references organisations(id) on delete set null,
  actor_id          uuid references profiles(id) on delete set null,
  actor_email       text,
  action            text not null,       -- insert | update | delete | login | export | approve ...
  entity_table      text not null,
  entity_id         uuid,
  summary           text,
  before_data       jsonb,
  after_data        jsonb,
  ip_address        inet,
  user_agent        text,
  occurred_at       timestamptz not null default now()
);

create index on audit_logs (org_id, occurred_at desc);
create index on audit_logs (entity_table, entity_id, occurred_at desc);
create index on audit_logs (actor_id, occurred_at desc);

-- ---------------------------------------------------------------------------
-- Integrations and system health
-- ---------------------------------------------------------------------------

create table integrations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references organisations(id) on delete cascade,
  kind              integration_kind not null,
  provider          text not null,      -- 'peach', 'ozow', 'clickatell', 'xero', 'sage', 'eskom'...
  name              text not null,
  status            integration_status not null default 'not_configured',
  is_sandbox        boolean not null default true,
  config            jsonb not null default '{}'::jsonb,
  credential_ref    text,
  last_success_at   timestamptz,
  last_failure_at   timestamptz,
  last_error        text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (org_id, kind, provider)
);

comment on column integrations.credential_ref is 'Name of the secret in the platform secret store. Secrets are never stored in this table.';

create table system_health_checks (
  id                bigserial primary key,
  component         text not null,
  status            integration_status not null,
  latency_ms        int,
  detail            text,
  checked_at        timestamptz not null default now()
);

create index on system_health_checks (component, checked_at desc);

create table webhook_events (
  id                uuid primary key default gen_random_uuid(),
  provider          text not null,
  event_type        text not null,
  external_id       text,
  payload           jsonb not null,
  signature_valid   boolean,
  processed_at      timestamptz,
  processing_error  text,
  received_at       timestamptz not null default now(),
  unique (provider, external_id)
);

create index on webhook_events (provider, received_at desc);

-- Accounting exports (journals pushed to Xero/Sage/QuickBooks).
create table accounting_exports (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references organisations(id) on delete cascade,
  integration_id    uuid references integrations(id) on delete set null,
  period_start      date not null,
  period_end        date not null,
  status            text not null default 'pending'
                    check (status in ('pending', 'running', 'completed', 'failed')),
  entry_count       int not null default 0,
  total_debit       numeric(16,2) not null default 0,
  total_credit      numeric(16,2) not null default 0,
  external_reference text,
  error_message     text,
  exported_by       uuid references profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  completed_at      timestamptz
);

-- ---------------------------------------------------------------------------
-- Support chatbot
-- ---------------------------------------------------------------------------

create table chat_conversations (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid references organisations(id) on delete cascade,
  profile_id        uuid not null references profiles(id) on delete cascade,
  subject           text,
  status            text not null default 'open'
                    check (status in ('open', 'awaiting_agent', 'resolved', 'closed')),
  -- Set when the bot hands the conversation to a human.
  escalated_at      timestamptz,
  assigned_to       uuid references profiles(id) on delete set null,
  maintenance_request_id uuid references maintenance_requests(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index on chat_conversations (profile_id, updated_at desc);

create table chat_messages (
  id                uuid primary key default gen_random_uuid(),
  conversation_id   uuid not null references chat_conversations(id) on delete cascade,
  role              text not null check (role in ('user', 'assistant', 'agent', 'system')),
  author_id         uuid references profiles(id) on delete set null,
  body              text not null,
  -- Structured actions the bot offered or performed.
  actions           jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now()
);

create index on chat_messages (conversation_id, created_at);

create trigger announcements_updated_at before update on announcements
  for each row execute function set_updated_at();
create trigger campaigns_updated_at before update on campaigns
  for each row execute function set_updated_at();
create trigger message_templates_updated_at before update on message_templates
  for each row execute function set_updated_at();
create trigger approvals_updated_at before update on approvals
  for each row execute function set_updated_at();
create trigger bank_accounts_updated_at before update on bank_accounts
  for each row execute function set_updated_at();
create trigger integrations_updated_at before update on integrations
  for each row execute function set_updated_at();
create trigger unit_applications_updated_at before update on unit_applications
  for each row execute function set_updated_at();
create trigger chat_conversations_updated_at before update on chat_conversations
  for each row execute function set_updated_at();
