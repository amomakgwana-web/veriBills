-- Arrears recovery workflow: assign a collector to a delinquent account, and
-- escalate the worst accounts through a legal matter with a stage history
-- (Intake -> Demand -> Filed -> Court -> Resolved).

alter table tenant_accounts
  add column assigned_collector_id uuid references profiles(id) on delete set null;

create type legal_case_stage as enum ('intake', 'demand', 'filed', 'court', 'resolved');

create table legal_cases (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references organisations(id) on delete cascade,
  account_id    uuid not null references tenant_accounts(id) on delete cascade,
  reference     text not null,
  stage         legal_case_stage not null default 'intake',
  -- Balance at the time the matter was opened; the account's live balance
  -- keeps moving independently as it is billed and paid.
  amount        numeric(14,2) not null check (amount >= 0),
  notes         text,
  opened_by     uuid references profiles(id) on delete set null,
  opened_at     timestamptz not null default now(),
  resolved_at   timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (org_id, reference)
);

create index on legal_cases (org_id, stage);
create index on legal_cases (account_id);

create trigger legal_cases_updated_at before update on legal_cases
  for each row execute function set_updated_at();

create table legal_case_events (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references legal_cases(id) on delete cascade,
  from_stage  legal_case_stage,
  to_stage    legal_case_stage not null,
  note        text,
  actor       uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);

create index on legal_case_events (case_id, created_at);

alter table legal_cases       enable row level security;
alter table legal_case_events enable row level security;

create policy legal_cases_select on legal_cases for select
  using (has_org_access(org_id));

create policy legal_cases_manage on legal_cases for all
  using (has_org_role(org_id, '{owner,admin,finance,manager}'))
  with check (has_org_role(org_id, '{owner,admin,finance,manager}'));

create policy legal_case_events_select on legal_case_events for select
  using (exists (
    select 1 from legal_cases lc where lc.id = case_id and has_org_access(lc.org_id)
  ));

create policy legal_case_events_manage on legal_case_events for all
  using (exists (
    select 1 from legal_cases lc
    where lc.id = case_id and has_org_role(lc.org_id, '{owner,admin,finance,manager}')
  ))
  with check (exists (
    select 1 from legal_cases lc
    where lc.id = case_id and has_org_role(lc.org_id, '{owner,admin,finance,manager}')
  ));
