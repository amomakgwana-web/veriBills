-- veriBills.com — Auth Hook extension + RLS policies.
--
-- This project shares its Supabase project ("xBilling") with an unrelated
-- municipal billing platform, and a Supabase project can only have ONE
-- active Custom Access Token Hook. db/010 of the municipal platform
-- (xBilling-xUtilities) already installed `public.custom_access_token_hook`
-- and wired it up in the dashboard. Rather than fight over that single
-- slot, this migration CREATE OR REPLACEs the same function to also
-- recognize veriBills users — a signed-in user is looked up in
-- `platform.users` first (municipal), then `vb_platform.users`
-- (veriBills); each JWT only ever carries one product's claims because a
-- given auth_user_id can only exist in one of the two tables. An `app`
-- claim (`xplatform` | `veribills`) lets both frontends and every RLS
-- policy below tell at a glance which product's session this is, even
-- though the claim key names (`role`, `name`) are shared vocabulary.
--
-- Like db/010 upstream, every Supabase-specific section is guarded to
-- no-op on a bare Postgres instance (CI, local dev without the Supabase
-- CLI) so `db/*.sql` still replays end to end there.

create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, platform, vb_platform, pg_temp
as $$
declare
  claims jsonb;
  municipal_row platform.users%rowtype;
  vb_row vb_platform.users%rowtype;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);

  select * into municipal_row from platform.users where auth_user_id = (event->>'user_id')::uuid;
  if municipal_row.id is not null then
    claims := jsonb_set(claims, '{app}', to_jsonb('xplatform'::text));
    claims := jsonb_set(claims, '{name}', to_jsonb(municipal_row.name));
    claims := jsonb_set(claims, '{persona}', to_jsonb(municipal_row.persona));
    claims := jsonb_set(claims, '{role}', to_jsonb(municipal_row.role));
    if municipal_row.account_number is not null then
      claims := jsonb_set(claims, '{accountNumber}', to_jsonb(municipal_row.account_number));
    end if;
    if municipal_row.municipality_id is not null then
      claims := jsonb_set(claims, '{municipalityId}', to_jsonb(municipal_row.municipality_id));
    end if;
    event := jsonb_set(event, '{claims}', claims);
    return event;
  end if;

  select * into vb_row from vb_platform.users where auth_user_id = (event->>'user_id')::uuid;
  if vb_row.id is not null then
    claims := jsonb_set(claims, '{app}', to_jsonb('veribills'::text));
    claims := jsonb_set(claims, '{name}', to_jsonb(vb_row.name));
    claims := jsonb_set(claims, '{role}', to_jsonb(vb_row.role));
    if vb_row.tenant_unit_id is not null then
      claims := jsonb_set(claims, '{tenantUnitId}', to_jsonb(vb_row.tenant_unit_id));
    end if;
  end if;

  event := jsonb_set(event, '{claims}', claims);
  return event;
end;
$$;

-- Same grants db/010 already set up for the function itself; only the
-- read grant on vb_platform.users is new.
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'supabase_auth_admin') then
    execute 'grant usage on schema vb_platform to supabase_auth_admin';
    execute 'grant select on vb_platform.users to supabase_auth_admin';
  end if;
end $$;

-- ============================================================================
-- RLS helper functions
--
-- security definer so they can look up the caller's own vb_platform.users
-- row (and the estates that row manages) without recursing through that
-- table's own RLS policies below. Each one only ever resolves data for
-- auth.uid() — the caller's own session — never an arbitrary user.
-- ============================================================================

-- language plpgsql (not sql) deliberately — like db/010's hook, a plpgsql
-- body isn't checked against the catalog until first call, so these can be
-- created unconditionally even on bare Postgres where the `auth` schema
-- these bodies reference doesn't exist (CI, local dev without the
-- Supabase CLI stack). A `language sql` version of the same function
-- fails at CREATE FUNCTION time in that environment.

create or replace function vb_platform.current_user_id()
returns text
language plpgsql
stable
security definer
set search_path = vb_platform, pg_temp
as $$
declare result text;
begin
  select id into result from vb_platform.users where auth_user_id = auth.uid();
  return result;
end;
$$;

create or replace function vb_platform.current_role()
returns text
language plpgsql
stable
security definer
set search_path = vb_platform, pg_temp
as $$
declare result text;
begin
  select role into result from vb_platform.users where auth_user_id = auth.uid();
  return result;
end;
$$;

create or replace function vb_platform.current_auth_uid()
returns uuid
language plpgsql
stable
security definer
set search_path = vb_platform, pg_temp
as $$
begin
  return auth.uid();
end;
$$;

create or replace function vb_platform.current_tenant_unit_id()
returns text
language plpgsql
stable
security definer
set search_path = vb_platform, pg_temp
as $$
declare result text;
begin
  select tenant_unit_id into result from vb_platform.users where auth_user_id = auth.uid();
  return result;
end;
$$;

-- Estates the caller owns (landlord) or manages (estate manager) — the two
-- roles the spec scopes to "the estate(s)/unit(s) they own/manage".
create or replace function vb_platform.managed_estate_ids()
returns setof text
language plpgsql
stable
security definer
set search_path = vb_platform, pg_temp
as $$
begin
  return query
    select estate_id from vb_platform.landlord_estates where user_id = vb_platform.current_user_id()
    union
    select estate_id from vb_platform.estate_manager_estates where user_id = vb_platform.current_user_id();
end;
$$;

create or replace function vb_platform.is_managed_estate(p_estate_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = vb_platform, pg_temp
as $$
begin
  return p_estate_id in (select vb_platform.managed_estate_ids());
end;
$$;

create or replace function vb_platform.is_managed_unit(p_unit_id text)
returns boolean
language plpgsql
stable
security definer
set search_path = vb_platform, pg_temp
as $$
declare found boolean;
begin
  select exists (
    select 1 from vb_platform.units u
    where u.id = p_unit_id and u.estate_id in (select vb_platform.managed_estate_ids())
  ) into found;
  return found;
end;
$$;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    execute 'grant usage on schema vb_platform, vb_metering, vb_billing, vb_ops, vb_events to authenticated';
    execute 'grant execute on function
        vb_platform.current_user_id(), vb_platform.current_role(),
        vb_platform.current_auth_uid(), vb_platform.current_tenant_unit_id(),
        vb_platform.managed_estate_ids(), vb_platform.is_managed_estate(text),
        vb_platform.is_managed_unit(text)
      to authenticated';
  end if;
end $$;

-- ============================================================================
-- Enable RLS on every veriBills table. authenticated has no implicit
-- access to anything below until a policy grants it; service_role (used
-- by every SECURITY DEFINER RPC function from db/003 onward) always
-- bypasses RLS, which is how invite/activation/vending/billing-run
-- writes happen without needing a client-side policy for every case.
-- ============================================================================

alter table vb_platform.estates enable row level security;
alter table vb_platform.units enable row level security;
alter table vb_platform.users enable row level security;
alter table vb_platform.landlord_estates enable row level security;
alter table vb_platform.estate_manager_estates enable row level security;
alter table vb_platform.leases enable row level security;
alter table vb_platform.tenant_invites enable row level security;
alter table vb_metering.tariffs enable row level security;
alter table vb_metering.meters enable row level security;
alter table vb_metering.readings enable row level security;
alter table vb_metering.prepaid_tokens enable row level security;
alter table vb_metering.loadshedding_schedules enable row level security;
alter table vb_billing.invoices enable row level security;
alter table vb_billing.invoice_lines enable row level security;
alter table vb_billing.credit_notes enable row level security;
alter table vb_billing.disputes enable row level security;
alter table vb_billing.dunning_log enable row level security;
alter table vb_billing.payment_transactions enable row level security;
alter table vb_ops.arrears_cases enable row level security;
alter table vb_ops.arrears_case_history enable row level security;
alter table vb_ops.legal_escalations enable row level security;
alter table vb_ops.payment_plans enable row level security;
alter table vb_ops.statement_templates enable row level security;
alter table vb_events.event_log enable row level security;
alter table vb_events.webhook_endpoints enable row level security;
alter table vb_events.webhook_deliveries enable row level security;

-- ============================================================================
-- SysAdmin — "Full access across all estates, units, and configuration."
-- One blanket for-all policy per table beats repeating it in every
-- role-specific block below.
-- ============================================================================

create policy sysadmin_all on vb_platform.estates for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_platform.units for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_platform.users for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_platform.landlord_estates for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_platform.estate_manager_estates for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_platform.leases for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_platform.tenant_invites for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_metering.tariffs for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_metering.meters for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_metering.readings for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_metering.prepaid_tokens for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_metering.loadshedding_schedules for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_billing.invoices for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_billing.invoice_lines for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_billing.credit_notes for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_billing.disputes for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_billing.dunning_log for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_billing.payment_transactions for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_ops.arrears_cases for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_ops.arrears_case_history for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_ops.legal_escalations for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_ops.payment_plans for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_ops.statement_templates for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_events.event_log for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_events.webhook_endpoints for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');
create policy sysadmin_all on vb_events.webhook_deliveries for all using (vb_platform.current_role() = 'sysadmin') with check (vb_platform.current_role() = 'sysadmin');

-- ============================================================================
-- Data Admin / Data Analyst — platform-wide read across every
-- vb_platform/vb_metering/vb_billing/vb_ops table ("full record-level
-- access" / "read/reporting access"). vb_events (xLayer) is out of scope
-- for both — xLayer is SysAdmin/IT Admin only per Section 5.3.
-- ============================================================================

create policy platform_wide_read on vb_platform.estates for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_platform.units for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_platform.users for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_platform.landlord_estates for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_platform.estate_manager_estates for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_platform.leases for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_platform.tenant_invites for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_metering.tariffs for select using (vb_platform.current_role() in ('data_admin', 'data_analyst', 'landlord', 'estate_manager', 'compliance_officer'));
create policy platform_wide_read on vb_metering.meters for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_metering.readings for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_metering.prepaid_tokens for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_metering.loadshedding_schedules for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_billing.invoices for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_billing.invoice_lines for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_billing.credit_notes for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_billing.disputes for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_billing.dunning_log for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_billing.payment_transactions for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_ops.arrears_cases for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_ops.arrears_case_history for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_ops.legal_escalations for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_ops.payment_plans for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));
create policy platform_wide_read on vb_ops.statement_templates for select using (vb_platform.current_role() in ('data_admin', 'data_analyst'));

-- Data Admin write scope — "Maintains the underlying data model: unit,
-- tenant, lease, and meter records; data corrections and imports. Full
-- record-level access; not necessarily full configuration access" —
-- deliberately narrower than SysAdmin: no estates, tariffs, billing runs,
-- or xLayer config.
create policy data_admin_write_ins on vb_platform.units for insert with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_upd on vb_platform.units for update using (vb_platform.current_role() = 'data_admin') with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_ins on vb_platform.users for insert with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_upd on vb_platform.users for update using (vb_platform.current_role() = 'data_admin') with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_ins on vb_platform.leases for insert with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_upd on vb_platform.leases for update using (vb_platform.current_role() = 'data_admin') with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_ins on vb_metering.meters for insert with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_upd on vb_metering.meters for update using (vb_platform.current_role() = 'data_admin') with check (vb_platform.current_role() = 'data_admin');
create policy data_admin_write_ins on vb_metering.readings for insert with check (vb_platform.current_role() = 'data_admin');

-- ============================================================================
-- Compliance Officer — "Read access to audit logs and case history across
-- the estates in scope." Scoped to the audit/case/dispute surface only,
-- platform-wide (no per-estate assignment table exists for this role).
-- ============================================================================

create policy compliance_read on vb_billing.disputes for select using (vb_platform.current_role() = 'compliance_officer');
create policy compliance_read on vb_billing.credit_notes for select using (vb_platform.current_role() = 'compliance_officer');
create policy compliance_read on vb_billing.invoices for select using (vb_platform.current_role() = 'compliance_officer');
create policy compliance_read on vb_billing.invoice_lines for select using (vb_platform.current_role() = 'compliance_officer');
create policy compliance_read on vb_ops.arrears_cases for select using (vb_platform.current_role() = 'compliance_officer');
create policy compliance_read on vb_ops.arrears_case_history for select using (vb_platform.current_role() = 'compliance_officer');
create policy compliance_read on vb_ops.legal_escalations for select using (vb_platform.current_role() = 'compliance_officer');
create policy compliance_read on vb_events.event_log for select using (vb_platform.current_role() = 'compliance_officer');

-- ============================================================================
-- Landlord / Estate Manager — both scoped to the estates they own/manage
-- via vb_platform.managed_estate_ids(). Estate Manager additionally gets
-- the operational write access the spec calls "day-to-day operations:
-- bill vetting, tenant invitations, arrears follow-up, meter management,
-- tenant communications"; Landlord is read-scoped plus the one explicit
-- write the spec grants it — inviting a tenant for its own unit — and
-- statement branding for its own estate.
-- ============================================================================

create policy estate_scoped_read on vb_platform.estates for select using (vb_platform.is_managed_estate(id));
create policy estate_scoped_read on vb_platform.units for select using (vb_platform.is_managed_estate(estate_id));
create policy estate_scoped_read on vb_platform.landlord_estates for select using (user_id = vb_platform.current_user_id());
create policy estate_scoped_read on vb_platform.estate_manager_estates for select using (user_id = vb_platform.current_user_id());
create policy estate_scoped_read on vb_platform.leases for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_platform.tenant_invites for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_platform.users for select using (
  vb_platform.current_role() in ('landlord', 'estate_manager')
  and role = 'tenant' and tenant_unit_id is not null and vb_platform.is_managed_unit(tenant_unit_id)
);
create policy estate_scoped_read on vb_metering.meters for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_metering.readings for select using (
  exists (select 1 from vb_metering.meters m where m.id = meter_id and vb_platform.is_managed_unit(m.unit_id))
);
create policy estate_scoped_read on vb_metering.prepaid_tokens for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_metering.loadshedding_schedules for select using (vb_platform.is_managed_estate(estate_id));
create policy estate_scoped_read on vb_billing.invoices for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_billing.invoice_lines for select using (
  exists (select 1 from vb_billing.invoices i where i.id = invoice_id and vb_platform.is_managed_unit(i.unit_id))
);
create policy estate_scoped_read on vb_billing.credit_notes for select using (
  exists (select 1 from vb_billing.invoices i where i.id = invoice_id and vb_platform.is_managed_unit(i.unit_id))
);
create policy estate_scoped_read on vb_billing.disputes for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_billing.dunning_log for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_billing.payment_transactions for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_ops.arrears_cases for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_ops.arrears_case_history for select using (
  exists (select 1 from vb_ops.arrears_cases c where c.id = case_id and vb_platform.is_managed_unit(c.unit_id))
);
create policy estate_scoped_read on vb_ops.legal_escalations for select using (
  exists (select 1 from vb_ops.arrears_cases c where c.id = case_id and vb_platform.is_managed_unit(c.unit_id))
);
create policy estate_scoped_read on vb_ops.payment_plans for select using (vb_platform.is_managed_unit(unit_id));
create policy estate_scoped_read on vb_ops.statement_templates for select using (
  estate_id is null or vb_platform.is_managed_estate(estate_id)
);

-- Tenant invite — the one write both Landlord and Estate Manager get per
-- Section 3.3/4.3 ("invite tenant" action against a unit they own/manage).
create policy estate_scoped_invite_tenant on vb_platform.tenant_invites for insert with check (
  vb_platform.current_role() in ('landlord', 'estate_manager')
  and vb_platform.is_managed_unit(unit_id)
  and invited_by = vb_platform.current_user_id()
);
create policy estate_scoped_invite_tenant on vb_platform.leases for insert with check (
  vb_platform.current_role() in ('landlord', 'estate_manager') and vb_platform.is_managed_unit(unit_id)
);

-- Statement branding — both roles may edit their own estate's template
-- (Section 4.2's contenteditable editor); platform-default (estate_id is
-- null) templates stay SysAdmin-only via the blanket policy above.
create policy estate_scoped_branding_ins on vb_ops.statement_templates for insert with check (
  vb_platform.current_role() in ('landlord', 'estate_manager')
  and estate_id is not null and vb_platform.is_managed_estate(estate_id)
  and updated_by = vb_platform.current_user_id()
);
create policy estate_scoped_branding_upd on vb_ops.statement_templates for update using (
  vb_platform.current_role() in ('landlord', 'estate_manager')
  and estate_id is not null and vb_platform.is_managed_estate(estate_id)
) with check (
  estate_id is not null and vb_platform.is_managed_estate(estate_id)
  and updated_by = vb_platform.current_user_id()
);

-- Estate Manager operational writes — bill vetting, arrears follow-up,
-- meter management, tenant communications (Section 4.2/4.3).
create policy estate_manager_write_ins on vb_platform.units for insert with check (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_estate(estate_id)
);
create policy estate_manager_write_upd on vb_platform.units for update using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_estate(estate_id)
) with check (vb_platform.is_managed_estate(estate_id));
create policy estate_manager_write on vb_platform.leases for update using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
) with check (vb_platform.is_managed_unit(unit_id));
create policy estate_manager_write on vb_platform.tenant_invites for update using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
) with check (vb_platform.is_managed_unit(unit_id));
create policy estate_manager_write_ins on vb_metering.meters for insert with check (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
);
create policy estate_manager_write_upd on vb_metering.meters for update using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
) with check (vb_platform.is_managed_unit(unit_id));
create policy estate_manager_write on vb_metering.readings for insert with check (
  vb_platform.current_role() = 'estate_manager'
  and exists (select 1 from vb_metering.meters m where m.id = meter_id and vb_platform.is_managed_unit(m.unit_id))
);
create policy estate_manager_write on vb_metering.loadshedding_schedules for all using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_estate(estate_id)
) with check (vb_platform.is_managed_estate(estate_id));
create policy estate_manager_write on vb_billing.invoices for update using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
) with check (vb_platform.is_managed_unit(unit_id));
create policy estate_manager_write on vb_billing.invoice_lines for update using (
  vb_platform.current_role() = 'estate_manager'
  and exists (select 1 from vb_billing.invoices i where i.id = invoice_id and vb_platform.is_managed_unit(i.unit_id))
);
create policy estate_manager_write on vb_billing.credit_notes for insert with check (
  vb_platform.current_role() = 'estate_manager'
  and exists (select 1 from vb_billing.invoices i where i.id = invoice_id and vb_platform.is_managed_unit(i.unit_id))
  and issued_by = vb_platform.current_user_id()
);
create policy estate_manager_write on vb_billing.disputes for update using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
) with check (vb_platform.is_managed_unit(unit_id));
create policy estate_manager_write on vb_billing.dunning_log for insert with check (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
);
create policy estate_manager_write on vb_ops.arrears_cases for update using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
) with check (vb_platform.is_managed_unit(unit_id));
create policy estate_manager_write on vb_ops.arrears_case_history for insert with check (
  vb_platform.current_role() = 'estate_manager'
  and exists (select 1 from vb_ops.arrears_cases c where c.id = case_id and vb_platform.is_managed_unit(c.unit_id))
);
create policy estate_manager_write on vb_ops.legal_escalations for all using (
  vb_platform.current_role() = 'estate_manager'
  and exists (select 1 from vb_ops.arrears_cases c where c.id = case_id and vb_platform.is_managed_unit(c.unit_id))
) with check (
  exists (select 1 from vb_ops.arrears_cases c where c.id = case_id and vb_platform.is_managed_unit(c.unit_id))
);
create policy estate_manager_write on vb_ops.payment_plans for all using (
  vb_platform.current_role() = 'estate_manager' and vb_platform.is_managed_unit(unit_id)
) with check (vb_platform.is_managed_unit(unit_id));

-- ============================================================================
-- Tenant — "scoped to their own unit and lease" (Section 3.3), the
-- narrowest-scoped role of the eight. No access to internal back-office
-- tables (arrears pipeline, legal escalation, statement templates).
-- ============================================================================

create policy tenant_read_own on vb_platform.estates for select using (
  exists (select 1 from vb_platform.units u where u.estate_id = id and u.id = vb_platform.current_tenant_unit_id())
);
create policy tenant_read_own on vb_platform.units for select using (id = vb_platform.current_tenant_unit_id());
create policy tenant_read_own on vb_platform.users for select using (auth_user_id = vb_platform.current_auth_uid());
create policy tenant_read_own on vb_platform.leases for select using (
  unit_id = vb_platform.current_tenant_unit_id() or tenant_user_id = vb_platform.current_user_id()
);
create policy tenant_read_own on vb_metering.meters for select using (unit_id = vb_platform.current_tenant_unit_id());
create policy tenant_read_own on vb_metering.readings for select using (
  exists (select 1 from vb_metering.meters m where m.id = meter_id and m.unit_id = vb_platform.current_tenant_unit_id())
);
create policy tenant_read_own on vb_metering.prepaid_tokens for select using (unit_id = vb_platform.current_tenant_unit_id());
create policy tenant_read_own on vb_billing.invoices for select using (unit_id = vb_platform.current_tenant_unit_id());
create policy tenant_read_own on vb_billing.invoice_lines for select using (
  exists (select 1 from vb_billing.invoices i where i.id = invoice_id and i.unit_id = vb_platform.current_tenant_unit_id())
);
create policy tenant_read_own on vb_billing.credit_notes for select using (
  exists (select 1 from vb_billing.invoices i where i.id = invoice_id and i.unit_id = vb_platform.current_tenant_unit_id())
);
create policy tenant_read_own on vb_billing.disputes for select using (unit_id = vb_platform.current_tenant_unit_id());
create policy tenant_read_own on vb_billing.dunning_log for select using (unit_id = vb_platform.current_tenant_unit_id());
create policy tenant_read_own on vb_billing.payment_transactions for select using (unit_id = vb_platform.current_tenant_unit_id());
create policy tenant_read_own on vb_ops.payment_plans for select using (unit_id = vb_platform.current_tenant_unit_id());

-- The one write a tenant gets directly (everything else — payments,
-- prepaid vending, invoice issuance — runs through SECURITY DEFINER RPCs
-- in db/003 onward): raising a billing dispute on their own unit.
create policy tenant_raise_dispute on vb_billing.disputes for insert with check (
  unit_id = vb_platform.current_tenant_unit_id()
);

-- ============================================================================
-- IT Admin — xLayer only ("Access to xLayer itself is restricted to
-- exactly two roles... No landlord, estate manager, data analyst,
-- compliance officer, or tenant has any access to xLayer" — Section 5.3).
-- SysAdmin's blanket policies above already cover the other half.
-- ============================================================================

create policy it_admin_xlayer on vb_events.event_log for all using (vb_platform.current_role() = 'it_admin') with check (vb_platform.current_role() = 'it_admin');
create policy it_admin_xlayer on vb_events.webhook_endpoints for all using (vb_platform.current_role() = 'it_admin') with check (vb_platform.current_role() = 'it_admin');
create policy it_admin_xlayer on vb_events.webhook_deliveries for all using (vb_platform.current_role() = 'it_admin') with check (vb_platform.current_role() = 'it_admin');
