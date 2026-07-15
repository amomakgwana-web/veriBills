-- PostgREST (what supabase-js's .from() talks to) only serves the `public`
-- schema by default — exposing another schema via the API needs a
-- dashboard/project-config change with no confirmed SQL path, the same
-- class of manual step as db/002's Auth Hook wiring. Rather than rely on
-- that, this takes the same approach the sibling xBilling-xUtilities repo's
-- db/014 already took: every vb_* table gets a `vb_`-prefixed straight
-- column-mapped view in `public` (snake_case -> the camelCase
-- @veribills/shared-types already expects), so a client only ever talks to
-- `public.vb_<table>`, never the domain schema directly.
--
-- Views don't have their own row security: a query against
-- `public.vb_invoices` still evaluates vb_billing.invoices' policies
-- (db/002) for whatever role/JWT is asking, because auth.jwt()/auth.uid()
-- read the session's claims, not the view's owner — `security_invoker =
-- true` is what makes that the case instead of the view running as its
-- (privileged) creator.
--
-- Every table from db/001 gets one of these; no masking exceptions the way
-- billing.banking_details needed one in the municipal platform — nothing
-- in this schema holds a raw secret that a passthrough view would leak
-- (tenant_invites.token is only ever readable by the landlord/estate
-- manager who generated it, via the exact same RLS scoping they already
-- have on the row itself).

create or replace view public.vb_estates with (security_invoker = true) as
select id, name, address, contact_email as "contactEmail", contact_phone as "contactPhone", created_at as "createdAt"
from vb_platform.estates;

create or replace view public.vb_units with (security_invoker = true) as
select id, estate_id as "estateId", unit_number as "unitNumber", created_at as "createdAt"
from vb_platform.units;

create or replace view public.vb_users with (security_invoker = true) as
select id, email, name, role, tenant_unit_id as "tenantUnitId", created_at as "createdAt"
from vb_platform.users;

create or replace view public.vb_landlord_estates with (security_invoker = true) as
select user_id as "userId", estate_id as "estateId"
from vb_platform.landlord_estates;

create or replace view public.vb_estate_manager_estates with (security_invoker = true) as
select user_id as "userId", estate_id as "estateId"
from vb_platform.estate_manager_estates;

create or replace view public.vb_leases with (security_invoker = true) as
select id, unit_id as "unitId", tenant_user_id as "tenantUserId", rent_amount as "rentAmount",
  start_date as "startDate", end_date as "endDate", status, created_at as "createdAt"
from vb_platform.leases;

create or replace view public.vb_tenant_invites with (security_invoker = true) as
select id, unit_id as "unitId", lease_id as "leaseId", email, token, invited_by as "invitedBy",
  status, created_at as "createdAt", activated_at as "activatedAt"
from vb_platform.tenant_invites;

create or replace view public.vb_tariffs with (security_invoker = true) as
select id, code, description, water_per_kl as "waterPerKl", electricity_per_kwh as "electricityPerKwh",
  vat_rate as "vatRate", valid_from as "validFrom", valid_to as "validTo"
from vb_metering.tariffs;

create or replace view public.vb_meters with (security_invoker = true) as
select id, unit_id as "unitId", type, serial, last_reading as "lastReading",
  last_reading_at as "lastReadingAt", status
from vb_metering.meters;

create or replace view public.vb_readings with (security_invoker = true) as
select id, meter_id as "meterId", reading, read_at as "readAt"
from vb_metering.readings;

create or replace view public.vb_prepaid_tokens with (security_invoker = true) as
select id, meter_id as "meterId", unit_id as "unitId", amount, units, token, vended_at as "vendedAt"
from vb_metering.prepaid_tokens;

create or replace view public.vb_loadshedding_schedules with (security_invoker = true) as
select id, estate_id as "estateId", stage, day_of_week as "dayOfWeek", start_time as "startTime", end_time as "endTime"
from vb_metering.loadshedding_schedules;

create or replace view public.vb_invoices with (security_invoker = true) as
select id, unit_id as "unitId", lease_id as "leaseId", billing_period as "billingPeriod",
  issue_date as "issueDate", due_date as "dueDate", total_amount as "totalAmount",
  amount_paid as "amountPaid", status, created_at as "createdAt"
from vb_billing.invoices;

create or replace view public.vb_invoice_lines with (security_invoker = true) as
select id, invoice_id as "invoiceId", category, description, quantity, unit_price as "unitPrice", amount
from vb_billing.invoice_lines;

create or replace view public.vb_credit_notes with (security_invoker = true) as
select id, invoice_id as "invoiceId", amount, reason, issued_by as "issuedBy", created_at as "createdAt"
from vb_billing.credit_notes;

create or replace view public.vb_disputes with (security_invoker = true) as
select id, invoice_id as "invoiceId", unit_id as "unitId", reason, description, status,
  resolution_note as "resolutionNote", created_at as "createdAt", resolved_at as "resolvedAt"
from vb_billing.disputes;

create or replace view public.vb_dunning_log with (security_invoker = true) as
select id, invoice_id as "invoiceId", unit_id as "unitId", channel, message, sent_at as "sentAt"
from vb_billing.dunning_log;

create or replace view public.vb_payment_transactions with (security_invoker = true) as
select ref, unit_id as "unitId", invoice_id as "invoiceId", amount, method, status,
  erp_status as "erpStatus", created_at as "createdAt"
from vb_billing.payment_transactions;

create or replace view public.vb_arrears_cases with (security_invoker = true) as
select id, unit_id as "unitId", invoice_id as "invoiceId", stage, assigned_to as "assignedTo",
  created_at as "createdAt", updated_at as "updatedAt"
from vb_ops.arrears_cases;

create or replace view public.vb_arrears_case_history with (security_invoker = true) as
select id, case_id as "caseId", from_stage as "fromStage", to_stage as "toStage", actor, note, created_at as "createdAt"
from vb_ops.arrears_case_history;

create or replace view public.vb_legal_escalations with (security_invoker = true) as
select id, case_id as "caseId", status, notes, created_at as "createdAt"
from vb_ops.legal_escalations;

create or replace view public.vb_payment_plans with (security_invoker = true) as
select id, unit_id as "unitId", invoice_id as "invoiceId", total_amount as "totalAmount",
  installments, installment_amount as "installmentAmount", start_date as "startDate",
  status, created_at as "createdAt"
from vb_ops.payment_plans;

create or replace view public.vb_statement_templates with (security_invoker = true) as
select id, estate_id as "estateId", name, html_content as "htmlContent",
  updated_by as "updatedBy", updated_at as "updatedAt"
from vb_ops.statement_templates;

create or replace view public.vb_event_log with (security_invoker = true) as
select id, event_type as "eventType", source, actor, payload, created_at as "createdAt"
from vb_events.event_log;

create or replace view public.vb_webhook_endpoints with (security_invoker = true) as
select id, name, url, active, created_at as "createdAt"
from vb_events.webhook_endpoints;

create or replace view public.vb_webhook_deliveries with (security_invoker = true) as
select id, event_id as "eventId", endpoint_id as "endpointId", status,
  response_code as "responseCode", error, attempted_at as "attemptedAt"
from vb_events.webhook_deliveries;

-- Grants — a view is unreachable through PostgREST without SELECT on the
-- view itself, same as every table in db/002 needed a GRANT before its
-- policy did anything (the view's underlying tables already have their own
-- authenticated grants from db/002; this adds the equivalent for the view
-- objects sitting in front of them). Guarded exactly like db/002: no-op on
-- bare Postgres, where the `authenticated` role doesn't exist.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'authenticated role not present — skipping view grants (not a Supabase-provisioned Postgres)';
    return;
  end if;

  execute 'grant usage on schema public to authenticated';
  execute 'grant select on
      public.vb_estates, public.vb_units, public.vb_users, public.vb_landlord_estates,
      public.vb_estate_manager_estates, public.vb_leases, public.vb_tenant_invites,
      public.vb_tariffs, public.vb_meters, public.vb_readings, public.vb_prepaid_tokens,
      public.vb_loadshedding_schedules, public.vb_invoices, public.vb_invoice_lines,
      public.vb_credit_notes, public.vb_disputes, public.vb_dunning_log,
      public.vb_payment_transactions, public.vb_arrears_cases, public.vb_arrears_case_history,
      public.vb_legal_escalations, public.vb_payment_plans, public.vb_statement_templates,
      public.vb_event_log, public.vb_webhook_endpoints, public.vb_webhook_deliveries
    to authenticated';
end $$;
