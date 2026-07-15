-- Retires the municipal billing platform's data model from this shared
-- Supabase project entirely — per explicit instruction, this project (now
-- renamed "veriBills" in the dashboard) is to be about veriBills only from
-- here on. This is a one-way migration: every citizen, invoice, payment,
-- and audit-trail row the municipal platform ever wrote is gone after this
-- runs. The xBilling-xUtilities application repository itself is untouched
-- — only this project's database contents.
--
-- Order matters:
--   1. Drop the public-schema views first (they select from platform/
--      billing/payments/metering/comms/compliance tables).
--   2. Drop the public-schema RPC functions explicitly — DROP SCHEMA
--      CASCADE does NOT reach these: their bodies are opaque plpgsql text,
--      so Postgres never recorded a pg_depend edge to the tables they
--      reference, unlike the views above (whose SQL bodies are parsed and
--      tracked).
--   3. Drop the six municipal schemas themselves, cascading through
--      whatever's left inside them (tables, indexes, in-schema functions,
--      policies).
--
-- public.rls_auto_enable() and its `ensure_rls` event trigger are left
-- alone — that's a project-wide safety net that auto-enables RLS on any
-- newly created table, not municipal-platform-specific.

drop view if exists
  public.accounts, public.api_keys, public.audit_events, public.banking_details,
  public.billing_runs, public.campaigns, public.chat_sessions, public.compliance_score,
  public.debicheck_mandates, public.disputes, public.frameworks, public.integrations,
  public.invoice_lines, public.invoices, public.meter_faults, public.meters, public.municipalities,
  public.payment_methods, public.payment_plans, public.subsidy_applications, public.tariffs,
  public.transactions, public.vended_tokens
cascade;

drop function if exists
  public._adjust_account_balance, public._append_audit_event, public._apply_payment_to_invoice,
  public._apply_payment_to_oldest_invoice, public._next_seq, public._tariff_in_force,
  public.apply_for_subsidy, public.create_api_key, public.create_campaign, public.create_dispute,
  public.create_fault, public.create_payment_plan, public.create_tariff, public.dispatch_fault,
  public.edit_municipality, public.ingest_meter_reading, public.initiate_payment,
  public.jwt_account_number, public.jwt_municipality_id, public.jwt_persona, public.kyc_verify,
  public.mark_campaign_sent, public.resolve_dispute, public.resolve_fault, public.resolve_recon,
  public.revoke_api_key, public.run_billing_period, public.run_recon, public.toggle_handover,
  public.upsert_banking_details, public.vend_token, public.verify_audit_chain
cascade;

drop schema if exists platform cascade;
drop schema if exists billing cascade;
drop schema if exists payments cascade;
drop schema if exists metering cascade;
drop schema if exists comms cascade;
drop schema if exists compliance cascade;

-- custom_access_token_hook now only ever needs to resolve veriBills users
-- — the municipal branch (platform.users lookup) is gone along with the
-- schema it read from. CREATE OR REPLACE, not DROP: this function stays
-- installed as the project's one active Auth Hook, still selected in
-- Authentication -> Hooks in the dashboard from db/010's setup; only its
-- body changes here.
create or replace function public.custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
stable
set search_path = public, vb_platform, pg_temp
as $$
declare
  claims jsonb;
  vb_row vb_platform.users%rowtype;
begin
  claims := coalesce(event->'claims', '{}'::jsonb);

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
