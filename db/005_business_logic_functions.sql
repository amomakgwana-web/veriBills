-- veriBills business logic — the RPC functions that back every write
-- flow in xBilling/xUtilities that isn't a plain RLS-permitted insert.
-- Mirrors the sibling xBilling-xUtilities repo's db/012 pattern exactly:
--
-- Every function is SECURITY DEFINER, runs as the migration owner, and
-- bypasses RLS from db/002 (which only ever covers reads for authenticated
-- — no table there grants INSERT/UPDATE/DELETE directly except the
-- specific scoped cases db/002 already documents). Authorization that
-- would otherwise need a broader RLS policy is re-checked at the top of
-- each function using the same vb_platform.current_role()/
-- current_user_id()/is_managed_estate()/is_managed_unit() helpers db/002
-- already introduced for RLS — one set of claim/scope readers, two
-- consumers (row filters there, explicit checks here).
--
-- Every function is plpgsql, not sql, for the same reason as db/002's
-- helpers: a plpgsql body is opaque until first call, so these are safe to
-- create unconditionally even where nothing in the body could resolve
-- (bare Postgres/CI never actually calls any of these).
--
-- Every mutating function appends an event via `public._vb_append_event`
-- at the end of a successful write — vb_events.event_log is xLayer's
-- audit/replay log (db/001's header), not a hash chain like the municipal
-- platform's compliance.audit_events, so this is a plain insert.

create extension if not exists pgcrypto;

-- ============================================================================
-- Internal helpers (leading underscore = not exposed to `authenticated`,
-- only ever called from inside another SECURITY DEFINER function in this
-- file).
-- ============================================================================

create or replace function public._vb_next_seq(p_schema text, p_table text, p_id_column text default 'id')
returns integer
language plpgsql
security definer
set search_path = pg_catalog, pg_temp
as $$
declare
  v_max integer;
begin
  execute format(
    'select max(cast(substring(%I from ''[0-9]+$'') as integer)) from %I.%I',
    p_id_column, p_schema, p_table
  ) into v_max;
  return coalesce(v_max, 99) + 1;
end;
$$;
revoke execute on function public._vb_next_seq(text, text, text) from public;

-- The tariff row for `p_code` that was actually in force on `p_on_date` —
-- same effective-dating lookup pattern as db/001's header describes for
-- vb_metering.tariffs.
create or replace function public._vb_tariff_in_force(p_code text, p_on_date date)
returns vb_metering.tariffs
language plpgsql
stable
security definer
set search_path = vb_metering, pg_catalog, pg_temp
as $$
declare
  v_row vb_metering.tariffs;
begin
  select * into v_row from vb_metering.tariffs
  where code = p_code and valid_from <= p_on_date and (valid_to is null or valid_to >= p_on_date)
  order by valid_from desc limit 1;
  return v_row;
end;
$$;
revoke execute on function public._vb_tariff_in_force(text, date) from public;

create or replace function public._vb_append_event(p_event_type text, p_source text, p_payload jsonb default '{}'::jsonb)
returns vb_events.event_log
language plpgsql
security definer
set search_path = vb_events, pg_catalog, pg_temp
as $$
declare
  v_row vb_events.event_log;
begin
  insert into vb_events.event_log (event_type, source, actor, payload)
  values (p_event_type, p_source, coalesce(auth.uid()::text, 'service'), p_payload)
  returning * into v_row;
  return v_row;
end;
$$;
revoke execute on function public._vb_append_event(text, text, jsonb) from public;

-- ============================================================================
-- Tenant onboarding (Section 3.3 / 4.2: "invite tenant" action)
-- ============================================================================

-- Records the tenant's details against a unit (step 1) and creates the
-- access-provisioning invite (step 2-3) in one call — landlord/estate
-- manager, scoped to a unit they own/manage. Credential creation itself
-- (step 4, the tenant setting their own password) needs the Supabase Auth
-- admin API, which only runs with the service_role key — that's the
-- activate-tenant Edge Function, not this function.
create or replace function public.vb_invite_tenant(
  p_unit_id text, p_email text, p_rent_amount numeric, p_start_date date default current_date
)
returns vb_platform.tenant_invites
language plpgsql
security definer
set search_path = vb_platform, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_lease_id text;
  v_invite_id text;
  v_token text;
  v_row vb_platform.tenant_invites;
begin
  if v_role not in ('landlord', 'estate_manager', 'sysadmin') then
    raise exception 'This operation is restricted to landlords and estate managers' using errcode = '42501';
  end if;
  if v_role in ('landlord', 'estate_manager') and not vb_platform.is_managed_unit(p_unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;
  if p_rent_amount <= 0 then
    raise exception 'rentAmount must be positive' using errcode = '22023';
  end if;

  select id into v_lease_id from vb_platform.leases where unit_id = p_unit_id and status = 'active';
  if v_lease_id is null then
    v_lease_id := 'LEASE-' || public._vb_next_seq('vb_platform', 'leases');
    insert into vb_platform.leases (id, unit_id, rent_amount, start_date, status)
    values (v_lease_id, p_unit_id, p_rent_amount, p_start_date, 'active');
  end if;

  v_invite_id := 'TINV-' || public._vb_next_seq('vb_platform', 'tenant_invites');
  v_token := encode(gen_random_bytes(24), 'hex');

  insert into vb_platform.tenant_invites (id, unit_id, lease_id, email, token, invited_by, status)
  values (v_invite_id, p_unit_id, v_lease_id, p_email, v_token, vb_platform.current_user_id(), 'pending')
  returning * into v_row;

  perform public._vb_append_event('tenant.invited', 'xutilities', jsonb_build_object('unitId', p_unit_id, 'email', p_email));
  return v_row;
end;
$$;
revoke execute on function public.vb_invite_tenant(text, text, numeric, date) from public;

-- ============================================================================
-- Billing (Section 3.1/4.1: consolidated statement — rent, water, metered
-- electricity as invoice lines; prepaid electricity is a separate wallet
-- top-up, never an invoice line, per db/001's header).
-- ============================================================================

-- Issues one consolidated invoice per active lease in the estate for the
-- period, computed from the lease's rent plus water/metered-electricity
-- consumption since the previous reading. Idempotent per unit+period
-- (skips units that already have an invoice for that period, same guard
-- the municipal platform's run_billing_period uses).
create or replace function public.vb_run_billing_period(p_estate_id text, p_billing_period text default null)
returns setof vb_billing.invoices
language plpgsql
security definer
set search_path = vb_platform, vb_metering, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_period text := coalesce(p_billing_period, to_char(now(), 'YYYY-MM'));
  v_issue_date date := current_date;
  v_due_date date := current_date + 7;
  v_tariff vb_metering.tariffs;
  v_lease record;
  v_meter record;
  v_consumption numeric;
  v_lines jsonb;
  v_subtotal numeric;
  v_vat numeric;
  v_total numeric;
  v_invoice_id text;
begin
  if v_role not in ('sysadmin', 'landlord', 'estate_manager') then
    raise exception 'This operation is restricted to landlords and estate managers' using errcode = '42501';
  end if;
  if v_role in ('landlord', 'estate_manager') and not vb_platform.is_managed_estate(p_estate_id) then
    raise exception 'This estate is outside your scope' using errcode = '42501';
  end if;

  v_tariff := public._vb_tariff_in_force('standard', v_issue_date);

  for v_lease in
    select l.* from vb_platform.leases l
    join vb_platform.units u on u.id = l.unit_id
    where u.estate_id = p_estate_id and l.status = 'active'
  loop
    if exists (select 1 from vb_billing.invoices where unit_id = v_lease.unit_id and billing_period = v_period) then
      continue;
    end if;

    v_lines := jsonb_build_array(jsonb_build_object(
      'description', 'Rent', 'category', 'rent', 'quantity', 1, 'unitPrice', v_lease.rent_amount, 'amount', v_lease.rent_amount
    ));

    if v_tariff.id is not null then
      for v_meter in select * from vb_metering.meters where unit_id = v_lease.unit_id and type in ('water', 'metered_electricity') loop
        select case when latest.reading is not null and previous.reading is not null
                 then greatest(0, latest.reading - previous.reading) else 0 end
        into v_consumption
        from (select reading from vb_metering.readings where meter_id = v_meter.id order by id desc limit 1) latest,
             (select reading from vb_metering.readings where meter_id = v_meter.id order by id desc offset 1 limit 1) previous;
        v_consumption := coalesce(v_consumption, 0);
        if v_consumption <= 0 then continue; end if;

        if v_meter.type = 'water' then
          v_lines := v_lines || jsonb_build_object(
            'description', 'Water consumption (' || v_meter.serial || ')', 'category', 'water',
            'quantity', v_consumption, 'unitPrice', v_tariff.water_per_kl, 'amount', round(v_consumption * v_tariff.water_per_kl, 2)
          );
        else
          v_lines := v_lines || jsonb_build_object(
            'description', 'Electricity consumption (' || v_meter.serial || ')', 'category', 'electricity',
            'quantity', v_consumption, 'unitPrice', v_tariff.electricity_per_kwh, 'amount', round(v_consumption * v_tariff.electricity_per_kwh, 2)
          );
        end if;
      end loop;
    end if;

    select round(sum((l ->> 'amount')::numeric), 2) into v_subtotal from jsonb_array_elements(v_lines) l;
    v_vat := round(v_subtotal * coalesce(v_tariff.vat_rate, 0.15), 2);
    v_lines := v_lines || jsonb_build_object(
      'description', 'VAT @ ' || round(coalesce(v_tariff.vat_rate, 0.15) * 100) || '%', 'category', 'other',
      'quantity', 1, 'unitPrice', v_vat, 'amount', v_vat
    );
    v_total := round(v_subtotal + v_vat, 2);

    v_invoice_id := 'INV-' || v_period || '-' || v_lease.unit_id;
    insert into vb_billing.invoices (id, unit_id, lease_id, billing_period, issue_date, due_date, total_amount, amount_paid, status)
    values (v_invoice_id, v_lease.unit_id, v_lease.id, v_period, v_issue_date, v_due_date, v_total, 0, 'pending');

    insert into vb_billing.invoice_lines (invoice_id, category, description, quantity, unit_price, amount)
    select v_invoice_id, l ->> 'category', l ->> 'description', (l ->> 'quantity')::numeric, (l ->> 'unitPrice')::numeric, (l ->> 'amount')::numeric
    from jsonb_array_elements(v_lines) l;

    perform public._vb_append_event('invoice.issued', 'xbilling', jsonb_build_object('invoiceId', v_invoice_id, 'unitId', v_lease.unit_id, 'amount', v_total));
  end loop;

  return query
    select i.* from vb_billing.invoices i
    join vb_platform.units u on u.id = i.unit_id
    where u.estate_id = p_estate_id and i.billing_period = v_period;
end;
$$;
revoke execute on function public.vb_run_billing_period(text, text) from public;

-- Marks invoices past due_date as overdue and opens an arrears case for
-- each one that doesn't already have one — the trigger into the kanban
-- pipeline described in Section 4.2. Manually invoked (no pg_cron
-- scheduling wired up) by an estate manager/sysadmin, scoped by estate.
create or replace function public.vb_flag_overdue_invoices(p_estate_id text)
returns setof vb_ops.arrears_cases
language plpgsql
security definer
set search_path = vb_platform, vb_billing, vb_ops, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_invoice record;
  v_case_id text;
begin
  if v_role not in ('sysadmin', 'landlord', 'estate_manager') then
    raise exception 'This operation is restricted to landlords and estate managers' using errcode = '42501';
  end if;
  if v_role in ('landlord', 'estate_manager') and not vb_platform.is_managed_estate(p_estate_id) then
    raise exception 'This estate is outside your scope' using errcode = '42501';
  end if;

  for v_invoice in
    select i.* from vb_billing.invoices i
    join vb_platform.units u on u.id = i.unit_id
    where u.estate_id = p_estate_id and i.status = 'pending' and i.due_date < current_date
  loop
    update vb_billing.invoices set status = 'overdue' where id = v_invoice.id;

    if not exists (select 1 from vb_ops.arrears_cases where invoice_id = v_invoice.id) then
      v_case_id := 'CASE-' || public._vb_next_seq('vb_ops', 'arrears_cases');
      insert into vb_ops.arrears_cases (id, unit_id, invoice_id, stage)
      values (v_case_id, v_invoice.unit_id, v_invoice.id, 'open');
      insert into vb_ops.arrears_case_history (case_id, from_stage, to_stage, actor, note)
      values (v_case_id, null, 'open', coalesce(auth.uid()::text, 'service'), 'Auto-opened: invoice ' || v_invoice.id || ' overdue');
      perform public._vb_append_event('arrears.case_opened', 'xutilities', jsonb_build_object('caseId', v_case_id, 'invoiceId', v_invoice.id));
    end if;
  end loop;

  return query
    select c.* from vb_ops.arrears_cases c
    join vb_platform.units u on u.id = c.unit_id
    where u.estate_id = p_estate_id;
end;
$$;
revoke execute on function public.vb_flag_overdue_invoices(text) from public;

-- ============================================================================
-- Dunning, disputes, credit notes (Section 3.1)
-- ============================================================================

create or replace function public.vb_send_dunning_reminder(p_invoice_id text, p_channel text, p_message text)
returns vb_billing.dunning_log
language plpgsql
security definer
set search_path = vb_platform, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_invoice vb_billing.invoices;
  v_row vb_billing.dunning_log;
begin
  if v_role not in ('sysadmin', 'estate_manager') then
    raise exception 'This operation is restricted to estate managers' using errcode = '42501';
  end if;
  if p_channel not in ('email', 'sms') then
    raise exception 'channel must be email or sms' using errcode = '22023';
  end if;

  select * into v_invoice from vb_billing.invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(v_invoice.unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;

  insert into vb_billing.dunning_log (invoice_id, unit_id, channel, message)
  values (p_invoice_id, v_invoice.unit_id, p_channel, p_message)
  returning * into v_row;

  perform public._vb_append_event('dunning.sent', 'xutilities', jsonb_build_object('invoiceId', p_invoice_id, 'channel', p_channel));
  return v_row;
end;
$$;
revoke execute on function public.vb_send_dunning_reminder(text, text, text) from public;

-- Tenant raises a dispute on their own unit's invoice. RLS (db/002) already
-- lets a tenant INSERT into vb_billing.disputes directly for this exact
-- case — this wrapper exists only to validate the invoice actually belongs
-- to the tenant's unit before the row is created, the same referential
-- check create_dispute in the municipal platform performs.
create or replace function public.vb_create_dispute(p_invoice_id text, p_reason text, p_description text)
returns vb_billing.disputes
language plpgsql
security definer
set search_path = vb_platform, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_unit_id text := vb_platform.current_tenant_unit_id();
  v_row vb_billing.disputes;
begin
  if v_unit_id is null then
    raise exception 'Only tenants may raise a dispute' using errcode = '42501';
  end if;
  if not exists (select 1 from vb_billing.invoices where id = p_invoice_id and unit_id = v_unit_id) then
    raise exception 'Invoice not found on your unit' using errcode = 'P0002';
  end if;

  insert into vb_billing.disputes (id, invoice_id, unit_id, reason, description, status)
  values ('DSP-' || public._vb_next_seq('vb_billing', 'disputes'), p_invoice_id, v_unit_id, p_reason, p_description, 'open')
  returning * into v_row;

  update vb_billing.invoices set status = 'disputed' where id = p_invoice_id;
  perform public._vb_append_event('dispute.opened', 'xbilling', jsonb_build_object('disputeId', v_row.id, 'invoiceId', p_invoice_id));
  return v_row;
end;
$$;
revoke execute on function public.vb_create_dispute(text, text, text) from public;

create or replace function public.vb_resolve_dispute(p_id text, p_status text, p_resolution_note text)
returns vb_billing.disputes
language plpgsql
security definer
set search_path = vb_platform, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_dispute vb_billing.disputes;
begin
  if v_role not in ('sysadmin', 'estate_manager') then
    raise exception 'This operation is restricted to estate managers' using errcode = '42501';
  end if;
  if p_status not in ('under_review', 'resolved', 'rejected') then
    raise exception 'status must be under_review, resolved, or rejected' using errcode = '22023';
  end if;

  select * into v_dispute from vb_billing.disputes where id = p_id;
  if v_dispute.id is null then
    raise exception 'Dispute not found' using errcode = 'P0002';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(v_dispute.unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;

  update vb_billing.disputes
  set status = p_status, resolution_note = p_resolution_note,
    resolved_at = case when p_status in ('resolved', 'rejected') then now() else resolved_at end
  where id = p_id
  returning * into v_dispute;

  if p_status = 'rejected' then
    update vb_billing.invoices set status = 'overdue' where id = v_dispute.invoice_id and due_date < current_date;
    update vb_billing.invoices set status = 'pending' where id = v_dispute.invoice_id and due_date >= current_date;
  elsif p_status = 'resolved' then
    update vb_billing.invoices set status = 'pending' where id = v_dispute.invoice_id and status = 'disputed';
  end if;

  perform public._vb_append_event('dispute.' || p_status, 'xutilities', jsonb_build_object('disputeId', p_id));
  return v_dispute;
end;
$$;
revoke execute on function public.vb_resolve_dispute(text, text, text) from public;

create or replace function public.vb_issue_credit_note(p_invoice_id text, p_amount numeric, p_reason text)
returns vb_billing.credit_notes
language plpgsql
security definer
set search_path = vb_platform, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_invoice vb_billing.invoices;
  v_row vb_billing.credit_notes;
begin
  if v_role not in ('sysadmin', 'estate_manager') then
    raise exception 'This operation is restricted to estate managers' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  select * into v_invoice from vb_billing.invoices where id = p_invoice_id;
  if v_invoice.id is null then
    raise exception 'Invoice not found' using errcode = 'P0002';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(v_invoice.unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;

  insert into vb_billing.credit_notes (id, invoice_id, amount, reason, issued_by)
  values ('CN-' || public._vb_next_seq('vb_billing', 'credit_notes'), p_invoice_id, p_amount, p_reason, vb_platform.current_user_id())
  returning * into v_row;

  update vb_billing.invoices
  set total_amount = greatest(amount_paid, total_amount - p_amount),
    status = case when amount_paid >= greatest(amount_paid, total_amount - p_amount) then 'paid' else status end
  where id = p_invoice_id;

  perform public._vb_append_event('credit_note.issued', 'xutilities', jsonb_build_object('creditNoteId', v_row.id, 'invoiceId', p_invoice_id, 'amount', p_amount));
  return v_row;
end;
$$;
revoke execute on function public.vb_issue_credit_note(text, numeric, text) from public;

-- ============================================================================
-- Arrears + legal escalation pipeline (Section 4.2: kanban with per-stage
-- history)
-- ============================================================================

create or replace function public.vb_move_arrears_case(p_case_id text, p_to_stage text, p_note text default null)
returns vb_ops.arrears_cases
language plpgsql
security definer
set search_path = vb_platform, vb_ops, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_case vb_ops.arrears_cases;
  v_from_stage text;
begin
  if v_role not in ('sysadmin', 'estate_manager') then
    raise exception 'This operation is restricted to estate managers' using errcode = '42501';
  end if;
  if p_to_stage not in ('open', 'contacted', 'payment_plan', 'legal_escalation', 'resolved', 'written_off') then
    raise exception 'Unknown stage %', p_to_stage using errcode = '22023';
  end if;

  select * into v_case from vb_ops.arrears_cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'Case not found' using errcode = 'P0002';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(v_case.unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;

  v_from_stage := v_case.stage;
  update vb_ops.arrears_cases set stage = p_to_stage, updated_at = now() where id = p_case_id returning * into v_case;

  insert into vb_ops.arrears_case_history (case_id, from_stage, to_stage, actor, note)
  values (p_case_id, v_from_stage, p_to_stage, coalesce(vb_platform.current_user_id(), 'service'), p_note);

  perform public._vb_append_event('arrears.stage_changed', 'xutilities', jsonb_build_object('caseId', p_case_id, 'fromStage', v_from_stage, 'toStage', p_to_stage));
  return v_case;
end;
$$;
revoke execute on function public.vb_move_arrears_case(text, text, text) from public;

-- Only valid once a case has actually reached the legal_escalation stage
-- (vb_move_arrears_case above) — this creates the legal-specific record
-- alongside it, per Section 4.2's arrears-vs-legal-escalation distinction.
create or replace function public.vb_escalate_to_legal(p_case_id text, p_notes text default null)
returns vb_ops.legal_escalations
language plpgsql
security definer
set search_path = vb_platform, vb_ops, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_case vb_ops.arrears_cases;
  v_row vb_ops.legal_escalations;
begin
  if v_role not in ('sysadmin', 'estate_manager') then
    raise exception 'This operation is restricted to estate managers' using errcode = '42501';
  end if;

  select * into v_case from vb_ops.arrears_cases where id = p_case_id;
  if v_case.id is null then
    raise exception 'Case not found' using errcode = 'P0002';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(v_case.unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;
  if v_case.stage <> 'legal_escalation' then
    raise exception 'Case must be in the legal_escalation stage first' using errcode = '22023';
  end if;

  insert into vb_ops.legal_escalations (id, case_id, status, notes)
  values ('LEGAL-' || public._vb_next_seq('vb_ops', 'legal_escalations'), p_case_id, 'referred', p_notes)
  returning * into v_row;

  perform public._vb_append_event('arrears.legal_escalated', 'xutilities', jsonb_build_object('caseId', p_case_id, 'escalationId', v_row.id));
  return v_row;
end;
$$;
revoke execute on function public.vb_escalate_to_legal(text, text) from public;

create or replace function public.vb_create_payment_plan(
  p_unit_id text, p_invoice_id text, p_total_amount numeric, p_installments integer, p_start_date date default current_date
)
returns vb_ops.payment_plans
language plpgsql
security definer
set search_path = vb_platform, vb_ops, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_row vb_ops.payment_plans;
begin
  if v_role not in ('sysadmin', 'estate_manager') then
    raise exception 'This operation is restricted to estate managers' using errcode = '42501';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(p_unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;
  if p_installments < 1 then
    raise exception 'installments must be at least 1' using errcode = '22023';
  end if;

  insert into vb_ops.payment_plans (id, unit_id, invoice_id, total_amount, installments, installment_amount, start_date, status)
  values (
    'PLAN-' || public._vb_next_seq('vb_ops', 'payment_plans'), p_unit_id, p_invoice_id, p_total_amount,
    p_installments, round(p_total_amount / p_installments, 2), p_start_date, 'active'
  )
  returning * into v_row;

  perform public._vb_append_event('payment_plan.created', 'xutilities', jsonb_build_object('planId', v_row.id, 'unitId', p_unit_id));
  return v_row;
end;
$$;
revoke execute on function public.vb_create_payment_plan(text, text, numeric, integer, date) from public;

-- ============================================================================
-- Tariff management (effective-dated, same close-prior-open-ended-row
-- pattern the municipal platform's billing.tariffs uses)
-- ============================================================================

create or replace function public.vb_create_tariff(
  p_code text, p_description text, p_water_per_kl numeric, p_electricity_per_kwh numeric,
  p_vat_rate numeric, p_valid_from date
)
returns vb_metering.tariffs
language plpgsql
security definer
set search_path = vb_platform, vb_metering, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_row vb_metering.tariffs;
begin
  if v_role not in ('sysadmin', 'data_admin') then
    raise exception 'This operation is restricted to SysAdmin/Data Admin' using errcode = '42501';
  end if;

  update vb_metering.tariffs
  set valid_to = p_valid_from - 1
  where code = p_code and valid_to is null and valid_from < p_valid_from;

  insert into vb_metering.tariffs (code, description, water_per_kl, electricity_per_kwh, vat_rate, valid_from, valid_to)
  values (p_code, p_description, p_water_per_kl, p_electricity_per_kwh, p_vat_rate, p_valid_from, null)
  returning * into v_row;

  perform public._vb_append_event('tariff.created', 'xutilities', jsonb_build_object('code', p_code, 'validFrom', p_valid_from));
  return v_row;
end;
$$;
revoke execute on function public.vb_create_tariff(text, text, numeric, numeric, numeric, date) from public;

-- ============================================================================
-- Metering: reading ingestion (updates meters.last_reading as a side
-- effect, the reason this isn't just a direct RLS-permitted insert) and
-- prepaid electricity vending (Section 3.2: wallet-style top-up).
-- ============================================================================

create or replace function public.vb_ingest_meter_reading(p_meter_id text, p_reading numeric, p_read_at timestamptz default now())
returns vb_metering.readings
language plpgsql
security definer
set search_path = vb_platform, vb_metering, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_meter vb_metering.meters;
  v_row vb_metering.readings;
begin
  if v_role not in ('sysadmin', 'data_admin', 'estate_manager') then
    raise exception 'This operation is restricted to meter-management staff' using errcode = '42501';
  end if;

  select * into v_meter from vb_metering.meters where id = p_meter_id;
  if v_meter.id is null then
    raise exception 'Meter not found' using errcode = 'P0002';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(v_meter.unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;

  insert into vb_metering.readings (meter_id, reading, read_at)
  values (p_meter_id, p_reading, p_read_at)
  returning * into v_row;

  update vb_metering.meters set last_reading = p_reading, last_reading_at = p_read_at where id = p_meter_id;

  perform public._vb_append_event('meter.reading_ingested', 'xutilities', jsonb_build_object('meterId', p_meter_id, 'reading', p_reading));
  return v_row;
end;
$$;
revoke execute on function public.vb_ingest_meter_reading(text, numeric, timestamptz) from public;

-- Tenant buys prepaid electricity credit for their own unit's prepaid
-- meter — units purchased = amount / tariff rate (VAT-inclusive), rounded
-- to 2dp; the token itself is a mock voucher code (no real prepaid vending
-- switch integration).
create or replace function public.vb_vend_prepaid_token(p_meter_id text, p_amount numeric)
returns vb_metering.prepaid_tokens
language plpgsql
security definer
set search_path = vb_platform, vb_metering, pg_catalog, pg_temp
as $$
declare
  v_unit_id text := vb_platform.current_tenant_unit_id();
  v_meter vb_metering.meters;
  v_tariff vb_metering.tariffs;
  v_units numeric;
  v_token text;
  v_row vb_metering.prepaid_tokens;
begin
  if v_unit_id is null then
    raise exception 'Only tenants may buy prepaid electricity' using errcode = '42501';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  select * into v_meter from vb_metering.meters where id = p_meter_id and unit_id = v_unit_id and type = 'prepaid_electricity';
  if v_meter.id is null then
    raise exception 'Prepaid meter not found on your unit' using errcode = 'P0002';
  end if;

  v_tariff := public._vb_tariff_in_force('standard', current_date);
  if v_tariff.id is null or v_tariff.electricity_per_kwh <= 0 then
    raise exception 'No active electricity tariff configured' using errcode = 'P0002';
  end if;

  v_units := round(p_amount / (v_tariff.electricity_per_kwh * (1 + v_tariff.vat_rate)), 2);
  v_token := left(regexp_replace(encode(gen_random_bytes(10), 'hex'), '(.{4})', '\1-', 'g'), 23);

  insert into vb_metering.prepaid_tokens (id, meter_id, unit_id, amount, units, token)
  values ('TOK-' || public._vb_next_seq('vb_metering', 'prepaid_tokens'), p_meter_id, v_unit_id, p_amount, v_units, v_token)
  returning * into v_row;

  perform public._vb_append_event('prepaid.vended', 'xbilling', jsonb_build_object('tokenId', v_row.id, 'unitId', v_unit_id, 'amount', p_amount, 'units', v_units));
  return v_row;
end;
$$;
revoke execute on function public.vb_vend_prepaid_token(text, numeric) from public;

-- ============================================================================
-- Mock sibling-platform adapters (Section 6: BipraPay.com payment
-- processing, MORR ERP posting, TransFund refunds — mocked per the
-- explicit decision to simulate these integrations rather than seek real
-- API access).
-- ============================================================================

-- Mock BipraPay.com charge — a tenant paying their own unit's invoice.
-- Applies the payment to the invoice immediately (a real gateway would
-- confirm asynchronously via webhook; the mock settles synchronously).
create or replace function public.vb_mock_bipra_pay_charge(p_invoice_id text, p_amount numeric, p_method text default 'card')
returns vb_billing.payment_transactions
language plpgsql
security definer
set search_path = vb_platform, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_unit_id text := vb_platform.current_tenant_unit_id();
  v_invoice vb_billing.invoices;
  v_ref text;
  v_row vb_billing.payment_transactions;
  v_new_paid numeric;
begin
  if v_unit_id is null then
    raise exception 'Only tenants may pay their own invoice' using errcode = '42501';
  end if;
  if p_method not in ('eft', 'card', 'debit_order') then
    raise exception 'method must be eft, card, or debit_order' using errcode = '22023';
  end if;
  if p_amount <= 0 then
    raise exception 'amount must be positive' using errcode = '22023';
  end if;

  select * into v_invoice from vb_billing.invoices where id = p_invoice_id and unit_id = v_unit_id;
  if v_invoice.id is null then
    raise exception 'Invoice not found on your unit' using errcode = 'P0002';
  end if;

  v_ref := 'PAY-' || public._vb_next_seq('vb_billing', 'payment_transactions', 'ref');
  insert into vb_billing.payment_transactions (ref, unit_id, invoice_id, amount, method, status, erp_status)
  values (v_ref, v_unit_id, p_invoice_id, p_amount, p_method, 'matched', 'pending')
  returning * into v_row;

  v_new_paid := least(v_invoice.total_amount, v_invoice.amount_paid + p_amount);
  update vb_billing.invoices
  set amount_paid = v_new_paid, status = case when v_new_paid >= total_amount then 'paid' else status end
  where id = p_invoice_id;

  perform public._vb_append_event('payment.settled', 'xbilling', jsonb_build_object('ref', v_ref, 'invoiceId', p_invoice_id, 'amount', p_amount));
  return v_row;
end;
$$;
revoke execute on function public.vb_mock_bipra_pay_charge(text, numeric, text) from public;

-- Mock MORR ERP posting — back-office reconciliation marking a settled
-- payment as posted to the group's ERP.
create or replace function public.vb_mock_morr_erp_post(p_ref text)
returns vb_billing.payment_transactions
language plpgsql
security definer
set search_path = vb_platform, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_row vb_billing.payment_transactions;
begin
  if v_role not in ('sysadmin', 'estate_manager', 'data_admin') then
    raise exception 'This operation is restricted to back-office staff' using errcode = '42501';
  end if;

  update vb_billing.payment_transactions set erp_status = 'posted' where ref = p_ref returning * into v_row;
  if v_row.ref is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;

  perform public._vb_append_event('payment.erp_posted', 'xutilities', jsonb_build_object('ref', p_ref));
  return v_row;
end;
$$;
revoke execute on function public.vb_mock_morr_erp_post(text) from public;

-- Mock TransFund refund/reversal hand-off.
create or replace function public.vb_mock_transfund_refund(p_ref text, p_amount numeric, p_reason text)
returns vb_billing.payment_transactions
language plpgsql
security definer
set search_path = vb_platform, vb_billing, pg_catalog, pg_temp
as $$
declare
  v_role text := vb_platform.current_role();
  v_payment vb_billing.payment_transactions;
begin
  if v_role not in ('sysadmin', 'estate_manager') then
    raise exception 'This operation is restricted to estate managers' using errcode = '42501';
  end if;

  select * into v_payment from vb_billing.payment_transactions where ref = p_ref;
  if v_payment.ref is null then
    raise exception 'Payment not found' using errcode = 'P0002';
  end if;
  if v_role = 'estate_manager' and not vb_platform.is_managed_unit(v_payment.unit_id) then
    raise exception 'This unit is outside your scope' using errcode = '42501';
  end if;
  if p_amount <= 0 or p_amount > v_payment.amount then
    raise exception 'amount must be positive and not exceed the original payment' using errcode = '22023';
  end if;

  update vb_billing.payment_transactions set status = 'failed' where ref = p_ref returning * into v_payment;

  if v_payment.invoice_id is not null then
    update vb_billing.invoices
    set amount_paid = greatest(0, amount_paid - p_amount),
      status = case when amount_paid - p_amount < total_amount then 'pending' else status end
    where id = v_payment.invoice_id;
  end if;

  perform public._vb_append_event('payment.refunded', 'xutilities', jsonb_build_object('ref', p_ref, 'amount', p_amount, 'reason', p_reason));
  return v_payment;
end;
$$;
revoke execute on function public.vb_mock_transfund_refund(text, numeric, text) from public;

-- ============================================================================
-- Grants — RPC functions are unreachable through PostgREST without
-- EXECUTE. Guarded exactly like db/002: no-op on bare Postgres.
-- ============================================================================

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    raise notice 'authenticated role not present — skipping RPC grants (not a Supabase-provisioned Postgres)';
    return;
  end if;

  execute 'grant execute on function public.vb_invite_tenant(text, text, numeric, date) to authenticated';
  execute 'grant execute on function public.vb_run_billing_period(text, text) to authenticated';
  execute 'grant execute on function public.vb_flag_overdue_invoices(text) to authenticated';
  execute 'grant execute on function public.vb_send_dunning_reminder(text, text, text) to authenticated';
  execute 'grant execute on function public.vb_create_dispute(text, text, text) to authenticated';
  execute 'grant execute on function public.vb_resolve_dispute(text, text, text) to authenticated';
  execute 'grant execute on function public.vb_issue_credit_note(text, numeric, text) to authenticated';
  execute 'grant execute on function public.vb_move_arrears_case(text, text, text) to authenticated';
  execute 'grant execute on function public.vb_escalate_to_legal(text, text) to authenticated';
  execute 'grant execute on function public.vb_create_payment_plan(text, text, numeric, integer, date) to authenticated';
  execute 'grant execute on function public.vb_create_tariff(text, text, numeric, numeric, numeric, date) to authenticated';
  execute 'grant execute on function public.vb_ingest_meter_reading(text, numeric, timestamptz) to authenticated';
  execute 'grant execute on function public.vb_vend_prepaid_token(text, numeric) to authenticated';
  execute 'grant execute on function public.vb_mock_bipra_pay_charge(text, numeric, text) to authenticated';
  execute 'grant execute on function public.vb_mock_morr_erp_post(text) to authenticated';
  execute 'grant execute on function public.vb_mock_transfund_refund(text, numeric, text) to authenticated';
end $$;
