-- veriBills :: 006 scoping helpers, sequence generation, ledger maintenance,
--                  billing run, tariff maths, usage detection, credit scoring

-- ---------------------------------------------------------------------------
-- Access-scoping helpers (SECURITY DEFINER so RLS policies can call them
-- without recursing back through the policies on the tables they read).
-- ---------------------------------------------------------------------------

create or replace function is_system_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select p.is_system_admin from profiles p where p.id = auth.uid()), false);
$$;

-- Orgs the caller is a staff member of.
create or replace function current_org_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select m.org_id from org_members m
  where m.profile_id = auth.uid() and m.is_active;
$$;

create or replace function has_org_access(target_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_system_admin() or exists (
    select 1 from org_members m
    where m.profile_id = auth.uid() and m.org_id = target_org and m.is_active
  );
$$;

-- Does the caller hold at least one of these roles in the org?
create or replace function has_org_role(target_org uuid, roles org_role[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select is_system_admin() or exists (
    select 1 from org_members m
    where m.profile_id = auth.uid()
      and m.org_id = target_org
      and m.is_active
      and m.role = any(roles)
  );
$$;

-- Leases the caller is a tenant on.
create or replace function current_lease_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select lt.lease_id from lease_tenants lt
  where lt.profile_id = auth.uid()
    and (lt.moved_out_at is null or lt.moved_out_at >= current_date);
$$;

create or replace function current_unit_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct l.unit_id from leases l
  where l.id in (select current_lease_ids());
$$;

create or replace function current_account_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select ta.id from tenant_accounts ta
  where ta.lease_id in (select current_lease_ids());
$$;

-- Properties the caller can see as a tenant (for announcements, facilities).
create or replace function current_property_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select distinct u.property_id from units u
  where u.id in (select current_unit_ids());
$$;

-- ---------------------------------------------------------------------------
-- Human-readable sequence numbers, scoped per org and per year.
-- ---------------------------------------------------------------------------

create table document_sequences (
  org_id            uuid not null references organisations(id) on delete cascade,
  kind              text not null,
  year              int not null,
  last_value        bigint not null default 0,
  primary key (org_id, kind, year)
);

create or replace function next_sequence_number(p_org uuid, p_kind text, p_prefix text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year int := extract(year from current_date)::int;
  v_next bigint;
begin
  insert into document_sequences (org_id, kind, year, last_value)
  values (p_org, p_kind, v_year, 1)
  on conflict (org_id, kind, year)
    do update set last_value = document_sequences.last_value + 1
  returning last_value into v_next;

  return format('%s-%s-%s', p_prefix, v_year, lpad(v_next::text, 6, '0'));
end;
$$;

-- ---------------------------------------------------------------------------
-- Ledger: keep running balance and account totals in step.
-- ---------------------------------------------------------------------------

create or replace function apply_ledger_entry()
returns trigger
language plpgsql
as $$
declare
  v_delta numeric(14,2);
  v_balance numeric(14,2);
begin
  -- Debits increase what the tenant owes, credits reduce it.
  v_delta := case when new.direction = 'debit' then new.amount else -new.amount end;

  update tenant_accounts
     set balance = balance + v_delta,
         last_payment_at = case when new.direction = 'credit' and new.payment_id is not null
                                then new.occurred_at else last_payment_at end,
         last_payment_amount = case when new.direction = 'credit' and new.payment_id is not null
                                then new.amount else last_payment_amount end,
         is_in_arrears = (balance + v_delta) > 0,
         updated_at = now()
   where id = new.account_id
  returning balance into v_balance;

  new.balance_after := v_balance;
  return new;
end;
$$;

create trigger ledger_entries_apply
  before insert on ledger_entries
  for each row execute function apply_ledger_entry();

-- The ledger is append-only: block edits and deletes outright.
create or replace function reject_ledger_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception 'ledger_entries is append-only; post a reversing entry instead';
end;
$$;

create trigger ledger_entries_no_update
  before update or delete on ledger_entries
  for each row execute function reject_ledger_mutation();

-- ---------------------------------------------------------------------------
-- Invoice numbering and totals
-- ---------------------------------------------------------------------------

create or replace function assign_invoice_number()
returns trigger
language plpgsql
as $$
begin
  if new.invoice_number is null or new.invoice_number = '' then
    new.invoice_number := next_sequence_number(new.org_id, 'invoice', 'INV');
  end if;
  return new;
end;
$$;

create trigger invoices_assign_number
  before insert on invoices
  for each row execute function assign_invoice_number();

-- Recalculate invoice totals whenever its lines change. This is a statement
-- level trigger, so it reads the affected ids from a transition table rather
-- than NEW/OLD, which do not exist at statement level.
create or replace function recalc_invoice_totals()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  update invoices i
     set subtotal  = coalesce(t.net, 0),
         vat_total = coalesce(t.vat, 0),
         total     = coalesce(t.total, 0)
    from (
      select il.invoice_id,
             sum(il.net_amount)   as net,
             sum(il.vat_amount)   as vat,
             sum(il.total_amount) as total
        from invoice_lines il
       where il.invoice_id in (select invoice_id from changed_rows)
       group by il.invoice_id
    ) t
   where i.id = t.invoice_id;

  -- An invoice whose last line was removed falls back to zero.
  update invoices i
     set subtotal = 0, vat_total = 0, total = 0
   where i.id in (select invoice_id from changed_rows)
     and not exists (select 1 from invoice_lines il where il.invoice_id = i.id);

  return null;
end;
$$;

create trigger invoice_lines_recalc_ins
  after insert on invoice_lines
  referencing new table as changed_rows
  for each statement execute function recalc_invoice_totals();

create trigger invoice_lines_recalc_upd
  after update on invoice_lines
  referencing new table as changed_rows
  for each statement execute function recalc_invoice_totals();

create trigger invoice_lines_recalc_del
  after delete on invoice_lines
  referencing old table as changed_rows
  for each statement execute function recalc_invoice_totals();

-- Derive invoice status from what has been paid.
create or replace function sync_invoice_status()
returns trigger
language plpgsql
as $$
begin
  if new.status in ('cancelled', 'written_off', 'draft') then
    return new;
  end if;

  if new.amount_paid >= new.total and new.total > 0 then
    new.status := 'paid';
    new.paid_at := coalesce(new.paid_at, now());
  elsif new.amount_paid > 0 then
    new.status := 'part_paid';
  elsif new.due_date < current_date then
    new.status := 'overdue';
  else
    new.status := 'issued';
  end if;

  return new;
end;
$$;

create trigger invoices_sync_status
  before update of amount_paid, due_date on invoices
  for each row execute function sync_invoice_status();

-- ---------------------------------------------------------------------------
-- Account creation: every active lease gets an account.
-- ---------------------------------------------------------------------------

create or replace function ensure_tenant_account()
returns trigger
language plpgsql
as $$
begin
  insert into tenant_accounts (org_id, lease_id, account_number)
  values (new.org_id, new.id, next_sequence_number(new.org_id, 'account', 'ACC'))
  on conflict (lease_id) do nothing;
  return new;
end;
$$;

create trigger leases_ensure_account
  after insert on leases
  for each row execute function ensure_tenant_account();

-- ---------------------------------------------------------------------------
-- Metering: derive consumption and refresh the meter's last reading.
-- ---------------------------------------------------------------------------

create or replace function derive_reading_consumption()
returns trigger
language plpgsql
as $$
declare
  v_prev numeric(14,3);
  v_multiplier numeric(10,4);
begin
  select multiplier into v_multiplier from meters where id = new.meter_id;

  select reading into v_prev
    from meter_readings
   where meter_id = new.meter_id and read_at < new.read_at
   order by read_at desc
   limit 1;

  if new.consumption is null then
    -- A reading below the previous one means the register rolled over or the
    -- meter was replaced; treat it as the raw reading rather than a negative.
    if v_prev is null then
      new.consumption := 0;
    elsif new.reading >= v_prev then
      new.consumption := (new.reading - v_prev) * coalesce(v_multiplier, 1);
    else
      new.consumption := new.reading * coalesce(v_multiplier, 1);
    end if;
  end if;

  return new;
end;
$$;

create trigger meter_readings_derive
  before insert on meter_readings
  for each row execute function derive_reading_consumption();

create or replace function refresh_meter_last_reading()
returns trigger
language plpgsql
as $$
begin
  update meters
     set last_reading = new.reading,
         last_reading_at = new.read_at,
         updated_at = now()
   where id = new.meter_id
     and (last_reading_at is null or last_reading_at <= new.read_at);
  return null;
end;
$$;

create trigger meter_readings_refresh_meter
  after insert on meter_readings
  for each row execute function refresh_meter_last_reading();

-- ---------------------------------------------------------------------------
-- Tariff maths: cost of N units under a stepped tariff.
-- ---------------------------------------------------------------------------

create or replace function calculate_tariff_cost(p_tariff uuid, p_units numeric)
returns table (net_amount numeric, vat_amount numeric, total_amount numeric)
language plpgsql
stable
as $$
declare
  v_block record;
  v_remaining numeric := greatest(p_units, 0);
  v_net numeric := 0;
  v_vat_rate numeric;
  v_fixed numeric;
  v_markup numeric;
  v_units_in_block numeric;
begin
  select vat_rate, fixed_charge, markup_percent
    into v_vat_rate, v_fixed, v_markup
    from tariffs where id = p_tariff;

  if not found then
    return query select 0::numeric, 0::numeric, 0::numeric;
    return;
  end if;

  for v_block in
    select * from tariff_blocks where tariff_id = p_tariff order by sequence
  loop
    exit when v_remaining <= 0;

    -- How much of the consumption falls inside this block.
    if v_block.block_to_units is null then
      v_units_in_block := v_remaining;
    else
      v_units_in_block := least(v_remaining, v_block.block_to_units - v_block.block_from_units);
    end if;

    v_net := v_net + (v_units_in_block * v_block.rate_per_unit);
    v_remaining := v_remaining - v_units_in_block;
  end loop;

  v_net := (v_net * (1 + v_markup / 100)) + v_fixed;
  v_net := round(v_net, 2);

  return query select
    v_net,
    round(v_net * v_vat_rate, 2),
    round(v_net * (1 + v_vat_rate), 2);
end;
$$;

-- Inverse: how many units does a given rand amount buy? Used for prepaid
-- electricity, where the tenant picks an amount rather than a kWh figure.
create or replace function units_for_amount(p_tariff uuid, p_amount numeric)
returns numeric
language plpgsql
stable
as $$
declare
  v_low numeric := 0;
  v_high numeric := 100000;
  v_mid numeric;
  v_cost numeric;
  i int := 0;
begin
  if p_amount <= 0 then
    return 0;
  end if;

  -- Stepped tariffs are monotonic in consumption, so bisect for the answer.
  while i < 60 loop
    v_mid := (v_low + v_high) / 2;
    select total_amount into v_cost from calculate_tariff_cost(p_tariff, v_mid);

    if v_cost > p_amount then
      v_high := v_mid;
    else
      v_low := v_mid;
    end if;

    exit when (v_high - v_low) < 0.001;
    i := i + 1;
  end loop;

  -- Truncate rather than round: rounding up can land on a quantity that costs
  -- fractionally more than the buyer actually paid.
  return trunc(v_low, 3);
end;
$$;

-- ---------------------------------------------------------------------------
-- Monthly billing run
-- ---------------------------------------------------------------------------

create or replace function run_billing(
  p_org uuid,
  p_period_start date,
  p_period_end date,
  p_due_date date,
  p_property uuid default null,
  p_run_by uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_run_id uuid;
  v_lease record;
  v_charge record;
  v_invoice_id uuid;
  v_account_id uuid;
  v_count int := 0;
  v_total numeric(16,2) := 0;
  v_invoice_total numeric(14,2);
  v_seq int;
  v_vat numeric(14,2);
  v_net numeric(14,2);
begin
  insert into billing_runs (org_id, property_id, period_start, period_end, due_date, status, started_at, run_by)
  values (p_org, p_property, p_period_start, p_period_end, p_due_date, 'running', now(), p_run_by)
  returning id into v_run_id;

  for v_lease in
    select l.*, u.property_id
      from leases l
      join units u on u.id = l.unit_id
     where l.org_id = p_org
       and l.status = 'active'
       and (p_property is null or u.property_id = p_property)
       and l.start_date <= p_period_end
       and (l.end_date is null or l.end_date >= p_period_start)
  loop
    select id into v_account_id from tenant_accounts where lease_id = v_lease.id;
    continue when v_account_id is null;

    -- Skip a lease that has already been billed for this period.
    if exists (
      select 1 from invoices
       where lease_id = v_lease.id
         and period_start = p_period_start
         and status <> 'cancelled'
    ) then
      continue;
    end if;

    insert into invoices (org_id, account_id, lease_id, unit_id, billing_run_id,
                          status, period_start, period_end, due_date)
    values (p_org, v_account_id, v_lease.id, v_lease.unit_id, v_run_id,
            'issued', p_period_start, p_period_end, p_due_date)
    returning id into v_invoice_id;

    v_seq := 0;

    -- Contracted rent and levy come off the lease itself.
    if v_lease.monthly_rent > 0 then
      v_seq := v_seq + 1;
      insert into invoice_lines (invoice_id, channel, description, quantity, unit_price,
                                 net_amount, vat_rate, vat_amount, total_amount, sequence)
      values (v_invoice_id, 'rent',
              format('Rent %s', to_char(p_period_start, 'Mon YYYY')),
              1, v_lease.monthly_rent, v_lease.monthly_rent, 0, 0, v_lease.monthly_rent, v_seq);
    end if;

    if v_lease.monthly_levy > 0 then
      v_seq := v_seq + 1;
      insert into invoice_lines (invoice_id, channel, description, quantity, unit_price,
                                 net_amount, vat_rate, vat_amount, total_amount, sequence)
      values (v_invoice_id, 'levy',
              format('Levy %s', to_char(p_period_start, 'Mon YYYY')),
              1, v_lease.monthly_levy, v_lease.monthly_levy, 0, 0, v_lease.monthly_levy, v_seq);
    end if;

    -- Additional recurring lease charges (refuse, security, parking...).
    for v_charge in
      select * from lease_charges
       where lease_id = v_lease.id
         and is_active
         and not is_metered
         and frequency = 'monthly'
         and start_date <= p_period_end
         and (end_date is null or end_date >= p_period_start)
    loop
      v_seq := v_seq + 1;
      v_net := v_charge.amount;
      v_vat := round(v_net * v_charge.vat_rate, 2);
      insert into invoice_lines (invoice_id, channel, description, quantity, unit_price,
                                 net_amount, vat_rate, vat_amount, total_amount, sequence)
      values (v_invoice_id, v_charge.type, v_charge.description, 1, v_net,
              v_net, v_charge.vat_rate, v_vat, v_net + v_vat, v_seq);
    end loop;

    -- Metered utilities: bill consumption recorded during the period.
    for v_charge in
      select m.id as meter_id, m.type, m.tariff_id,
             coalesce(sum(r.consumption), 0) as consumption,
             min(r.reading) as reading_from,
             max(r.reading) as reading_to
        from meters m
        left join meter_readings r
               on r.meter_id = m.id
              and r.read_at >= p_period_start
              and r.read_at < (p_period_end + 1)
       where m.unit_id = v_lease.unit_id
         and m.is_active
         and m.type in ('water', 'electricity_conventional', 'gas')
       group by m.id, m.type, m.tariff_id
    loop
      continue when v_charge.consumption <= 0 or v_charge.tariff_id is null;

      select net_amount, vat_amount into v_net, v_vat
        from calculate_tariff_cost(v_charge.tariff_id, v_charge.consumption);

      v_seq := v_seq + 1;
      insert into invoice_lines (invoice_id, channel, description, quantity, unit_price,
                                 net_amount, vat_rate, vat_amount, total_amount,
                                 meter_id, reading_from, reading_to, sequence)
      values (v_invoice_id,
              case when v_charge.type = 'water' then 'water'::charge_type else 'electricity'::charge_type end,
              format('%s consumption %s', initcap(replace(v_charge.type::text, '_', ' ')), to_char(p_period_start, 'Mon YYYY')),
              v_charge.consumption,
              case when v_charge.consumption > 0 then round(v_net / v_charge.consumption, 6) else 0 end,
              v_net, 0.15, v_vat, v_net + v_vat,
              v_charge.meter_id, v_charge.reading_from, v_charge.reading_to, v_seq);
    end loop;

    select total into v_invoice_total from invoices where id = v_invoice_id;

    -- An invoice with no lines is noise; drop it.
    if coalesce(v_invoice_total, 0) <= 0 then
      delete from invoices where id = v_invoice_id;
      continue;
    end if;

    -- Post the charge to the ledger, split per channel so the tenant's
    -- per-channel history stays accurate.
    insert into ledger_entries (org_id, account_id, direction, channel, amount,
                                description, occurred_at, invoice_id, reference)
    select p_org, v_account_id, 'debit', il.channel, sum(il.total_amount),
           format('Invoice %s', i.invoice_number), p_period_start::timestamptz, v_invoice_id, i.invoice_number
      from invoice_lines il
      join invoices i on i.id = il.invoice_id
     where il.invoice_id = v_invoice_id
     group by il.channel, i.invoice_number
    having sum(il.total_amount) > 0;

    v_count := v_count + 1;
    v_total := v_total + v_invoice_total;
  end loop;

  update billing_runs
     set status = 'completed',
         invoices_created = v_count,
         total_billed = v_total,
         completed_at = now()
   where id = v_run_id;

  return v_run_id;
exception when others then
  update billing_runs
     set status = 'failed', error_message = sqlerrm, completed_at = now()
   where id = v_run_id;
  raise;
end;
$$;

-- ---------------------------------------------------------------------------
-- Payment settlement: allocate to invoices oldest-first, post ledger credits.
-- ---------------------------------------------------------------------------

create or replace function settle_payment(p_payment uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_payment record;
  v_invoice record;
  v_remaining numeric(14,2);
  v_apply numeric(14,2);
  v_channel charge_type;
begin
  select * into v_payment from payments where id = p_payment;
  if not found then
    raise exception 'payment % not found', p_payment;
  end if;

  if v_payment.account_id is null then
    return;   -- e.g. a standalone prepaid electricity purchase
  end if;

  if exists (select 1 from ledger_entries where payment_id = p_payment) then
    return;   -- already settled
  end if;

  v_remaining := v_payment.amount;

  for v_invoice in
    select * from invoices
     where account_id = v_payment.account_id
       and status in ('issued', 'part_paid', 'overdue')
     order by due_date asc, created_at asc
  loop
    exit when v_remaining <= 0;

    v_apply := least(v_remaining, v_invoice.amount_due);
    continue when v_apply <= 0;

    update invoices set amount_paid = amount_paid + v_apply where id = v_invoice.id;

    -- Attribute the money to the channel carrying the largest share of the
    -- invoice, so per-channel history reflects what was actually settled.
    select channel into v_channel
      from invoice_lines
     where invoice_id = v_invoice.id
     group by channel
     order by sum(total_amount) desc
     limit 1;

    insert into payment_allocations (payment_id, invoice_id, channel, amount)
    values (p_payment, v_invoice.id, coalesce(v_channel, 'other'), v_apply);

    insert into ledger_entries (org_id, account_id, direction, channel, amount,
                                description, occurred_at, invoice_id, payment_id, reference)
    values (v_payment.org_id, v_payment.account_id, 'credit', coalesce(v_channel, 'other'), v_apply,
            format('Payment against %s', v_invoice.invoice_number),
            coalesce(v_payment.captured_at, now()), v_invoice.id, p_payment, v_payment.reference);

    v_remaining := v_remaining - v_apply;
  end loop;

  -- Anything left over sits on the account as a credit.
  if v_remaining > 0 then
    insert into ledger_entries (org_id, account_id, direction, channel, amount,
                                description, occurred_at, payment_id, reference)
    values (v_payment.org_id, v_payment.account_id, 'credit',
            coalesce(v_payment.intent_channel, 'other'), v_remaining,
            'Payment received (unallocated credit)',
            coalesce(v_payment.captured_at, now()), p_payment, v_payment.reference);
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Ageing buckets
-- ---------------------------------------------------------------------------

create or replace function refresh_account_ageing(p_org uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update tenant_accounts ta
     set current_due      = coalesce(a.d0, 0),
         overdue_30       = coalesce(a.d30, 0),
         overdue_60       = coalesce(a.d60, 0),
         overdue_90       = coalesce(a.d90, 0),
         overdue_120_plus = coalesce(a.d120, 0),
         updated_at       = now()
    from (
      select i.account_id,
             sum(i.amount_due) filter (where current_date - i.due_date <= 0)                as d0,
             sum(i.amount_due) filter (where current_date - i.due_date between 1 and 30)    as d30,
             sum(i.amount_due) filter (where current_date - i.due_date between 31 and 60)   as d60,
             sum(i.amount_due) filter (where current_date - i.due_date between 61 and 90)   as d90,
             sum(i.amount_due) filter (where current_date - i.due_date > 90)                as d120
        from invoices i
       where i.org_id = p_org
         and i.status in ('issued', 'part_paid', 'overdue')
       group by i.account_id
    ) a
   where ta.id = a.account_id and ta.org_id = p_org;
$$;

-- ---------------------------------------------------------------------------
-- Usage monitoring: compare the latest reading against the unit's baseline.
-- ---------------------------------------------------------------------------

create or replace function refresh_usage_baseline(p_meter uuid, p_days int default 30)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meter record;
begin
  select m.*, u.id as unit
    into v_meter
    from meters m join units u on u.id = m.unit_id
   where m.id = p_meter;

  if not found then return; end if;

  insert into usage_baselines (org_id, unit_id, meter_id, utility, period_days,
                               mean_consumption, stddev_consumption, peak_consumption,
                               sample_count, computed_at)
  select v_meter.org_id, v_meter.unit, p_meter, v_meter.type, p_days,
         coalesce(avg(consumption), 0),
         coalesce(stddev_pop(consumption), 0),
         coalesce(max(consumption), 0),
         count(*),
         now()
    from meter_readings
   where meter_id = p_meter
     and read_at >= now() - make_interval(days => p_days * 6)
  on conflict (meter_id, period_days) do update
    set mean_consumption   = excluded.mean_consumption,
        stddev_consumption = excluded.stddev_consumption,
        peak_consumption   = excluded.peak_consumption,
        sample_count       = excluded.sample_count,
        computed_at        = now();
end;
$$;

create or replace function detect_usage_anomaly()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_meter record;
  v_baseline record;
  v_rule record;
  v_deviation numeric;
begin
  select m.*, u.id as unit_id_resolved into v_meter
    from meters m left join units u on u.id = m.unit_id
   where m.id = new.meter_id;

  if v_meter.unit_id_resolved is null then
    return null;   -- bulk/common-area meter, nothing tenant-facing to flag
  end if;

  select * into v_baseline
    from usage_baselines
   where meter_id = new.meter_id and period_days = 30;

  -- Need a settled baseline before deviations mean anything.
  if not found or v_baseline.sample_count < 3 or v_baseline.mean_consumption <= 0 then
    return null;
  end if;

  select * into v_rule
    from usage_rules
   where org_id = v_meter.org_id
     and utility = v_meter.type
     and is_active
     and (property_id is null or property_id = v_meter.property_id)
   order by property_id nulls last
   limit 1;

  if not found then
    return null;
  end if;

  v_deviation := ((new.consumption - v_baseline.mean_consumption) / v_baseline.mean_consumption) * 100;

  if v_deviation >= coalesce(v_rule.spike_percent, 50)
     or (v_rule.absolute_threshold is not null and new.consumption >= v_rule.absolute_threshold)
  then
    insert into usage_alerts (org_id, unit_id, meter_id, utility, severity, rule, title, detail,
                              observed_value, expected_value, deviation_percent,
                              period_start, period_end)
    values (v_meter.org_id, v_meter.unit_id_resolved, new.meter_id, v_meter.type,
            case when v_deviation >= 150 then 'critical'::alert_severity else v_rule.severity end,
            'spike',
            format('High %s consumption detected', replace(v_meter.type::text, '_', ' ')),
            format('Recorded %s against a 30-day average of %s (%s%% above normal).',
                   round(new.consumption, 2), round(v_baseline.mean_consumption, 2), round(v_deviation, 1)),
            new.consumption, v_baseline.mean_consumption, round(v_deviation, 2),
            v_meter.last_reading_at, new.read_at);
  end if;

  return null;
end;
$$;

create trigger meter_readings_detect_anomaly
  after insert on meter_readings
  for each row execute function detect_usage_anomaly();

-- ---------------------------------------------------------------------------
-- Tenant behaviour score
-- ---------------------------------------------------------------------------

create or replace function compute_tenant_score(p_org uuid, p_profile uuid)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_account uuid;
  v_on_time int := 0;
  v_late int := 0;
  v_missed int := 0;
  v_failed int := 0;
  v_avg_late numeric := 0;
  v_months int := 0;
  v_arrears numeric := 0;
  v_score int := 100;
  v_band text;
begin
  select ta.id into v_account
    from tenant_accounts ta
    join lease_tenants lt on lt.lease_id = ta.lease_id
   where lt.profile_id = p_profile and ta.org_id = p_org
   order by lt.is_primary desc
   limit 1;

  if v_account is null then
    return null;
  end if;

  select coalesce(balance, 0) into v_arrears from tenant_accounts where id = v_account;

  -- Settled invoices: on time if fully paid on or before the due date.
  select
    count(*) filter (where i.paid_at::date <= i.due_date),
    count(*) filter (where i.paid_at::date > i.due_date),
    count(*) filter (where i.status in ('issued', 'overdue', 'part_paid') and i.due_date < current_date),
    coalesce(avg(greatest(i.paid_at::date - i.due_date, 0)) filter (where i.paid_at is not null), 0)
    into v_on_time, v_late, v_missed, v_avg_late
    from invoices i
   where i.account_id = v_account;

  select count(*) into v_failed
    from collections c
   where c.account_id = v_account and c.status = 'failed';

  select greatest(0, (extract(year from age(current_date, min(l.start_date))) * 12
                    + extract(month from age(current_date, min(l.start_date))))::int)
    into v_months
    from leases l join tenant_accounts ta on ta.lease_id = l.id
   where ta.id = v_account;

  -- Deduct for each category of bad behaviour, then credit tenure.
  v_score := v_score
    - least(v_late * 4, 25)
    - least(v_missed * 12, 45)
    - least(v_failed * 6, 20)
    - least((v_avg_late / 5)::int, 10)
    + least(v_months / 6, 8)::int;

  if v_arrears > 0 then
    v_score := v_score - least((v_arrears / 1000)::int, 15);
  end if;

  v_score := greatest(0, least(100, v_score));

  v_band := case
    when v_score >= 85 then 'excellent'
    when v_score >= 70 then 'good'
    when v_score >= 55 then 'fair'
    when v_score >= 40 then 'poor'
    else 'high_risk'
  end;

  insert into tenant_scores (org_id, profile_id, account_id, score, band,
                             on_time_payments, late_payments, missed_payments,
                             failed_collections, average_days_late, months_tenancy,
                             current_arrears, computed_at)
  values (p_org, p_profile, v_account, v_score, v_band,
          v_on_time, v_late, v_missed, v_failed, round(v_avg_late, 2), v_months,
          greatest(v_arrears, 0), now())
  on conflict (org_id, profile_id) do update
    set score = excluded.score,
        band = excluded.band,
        account_id = excluded.account_id,
        on_time_payments = excluded.on_time_payments,
        late_payments = excluded.late_payments,
        missed_payments = excluded.missed_payments,
        failed_collections = excluded.failed_collections,
        average_days_late = excluded.average_days_late,
        months_tenancy = excluded.months_tenancy,
        current_arrears = excluded.current_arrears,
        computed_at = now();

  return v_score;
end;
$$;

-- ---------------------------------------------------------------------------
-- Access code redemption (atomic: validate, count, log the event)
-- ---------------------------------------------------------------------------

create or replace function redeem_access_code(
  p_property uuid,
  p_code text,
  p_gate text default null,
  p_direction text default 'entry'
)
returns table (allowed boolean, result text, code_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code record;
  v_result text;
  v_org uuid;
begin
  select org_id into v_org from properties where id = p_property;

  select * into v_code
    from access_codes
   where property_id = p_property and code = p_code
   order by created_at desc
   limit 1
   for update;

  if not found then
    v_result := 'denied_unknown';
  elsif v_code.status = 'revoked' then
    v_result := 'denied_revoked';
  elsif now() > v_code.valid_until or now() < v_code.valid_from then
    v_result := 'denied_expired';
    update access_codes set status = 'expired' where id = v_code.id and status = 'active';
  elsif v_code.use_count >= v_code.max_uses then
    v_result := 'denied_exhausted';
    update access_codes set status = 'used' where id = v_code.id and status = 'active';
  else
    v_result := 'granted';
    update access_codes
       set use_count = use_count + 1,
           status = case when use_count + 1 >= max_uses then 'used'::access_code_status else status end
     where id = v_code.id;
  end if;

  insert into access_events (org_id, property_id, access_code_id, gate, direction, result, scanned_code)
  values (v_org, p_property, v_code.id, p_gate, p_direction, v_result, p_code);

  return query select v_result = 'granted', v_result, v_code.id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Facility access check (honours the good-standing rule)
-- ---------------------------------------------------------------------------

create or replace function check_facility_access(p_facility uuid, p_profile uuid)
returns table (allowed boolean, result text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_facility record;
  v_grant record;
  v_balance numeric;
  v_result text;
begin
  select * into v_facility from facilities where id = p_facility;
  if not found or not v_facility.is_active then
    return query select false, 'denied_closed';
    return;
  end if;

  if current_time not between v_facility.opens_at and v_facility.closes_at then
    v_result := 'denied_closed';
  else
    select * into v_grant
      from facility_access_grants
     where facility_id = p_facility and profile_id = p_profile;

    if not found then
      v_result := 'denied_no_grant';
    elsif v_grant.status <> 'active' then
      v_result := 'denied_suspended';
    else
      select coalesce(max(ta.balance), 0) into v_balance
        from tenant_accounts ta
        join lease_tenants lt on lt.lease_id = ta.lease_id
       where lt.profile_id = p_profile and ta.org_id = v_facility.org_id;

      if v_facility.requires_good_standing and v_balance > 0 then
        v_result := 'denied_arrears';
      else
        v_result := 'granted';
      end if;
    end if;
  end if;

  insert into facility_access_events (org_id, facility_id, profile_id, grant_id, result)
  values (v_facility.org_id, p_facility, p_profile, v_grant.id, v_result);

  return query select v_result = 'granted', v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit trigger, attached to the tables worth tracking.
-- ---------------------------------------------------------------------------

create or replace function write_audit_log()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_org uuid;
  v_id uuid;
  v_before jsonb;
  v_after jsonb;
begin
  if tg_op = 'DELETE' then
    v_before := to_jsonb(old);
    v_after := null;
    v_id := old.id;
  elsif tg_op = 'INSERT' then
    v_before := null;
    v_after := to_jsonb(new);
    v_id := new.id;
  else
    v_before := to_jsonb(old);
    v_after := to_jsonb(new);
    v_id := new.id;
  end if;

  v_org := nullif(coalesce(v_after ->> 'org_id', v_before ->> 'org_id'), '')::uuid;

  insert into audit_logs (org_id, actor_id, action, entity_table, entity_id, before_data, after_data)
  values (v_org, auth.uid(), lower(tg_op), tg_table_name, v_id, v_before, v_after);

  return null;
end;
$$;

create trigger audit_leases after insert or update or delete on leases
  for each row execute function write_audit_log();
create trigger audit_payments after insert or update or delete on payments
  for each row execute function write_audit_log();
create trigger audit_bank_accounts after insert or update or delete on bank_accounts
  for each row execute function write_audit_log();
create trigger audit_approvals after insert or update or delete on approvals
  for each row execute function write_audit_log();
create trigger audit_org_members after insert or update or delete on org_members
  for each row execute function write_audit_log();
create trigger audit_debicheck_mandates after insert or update or delete on debicheck_mandates
  for each row execute function write_audit_log();
create trigger audit_units after insert or update or delete on units
  for each row execute function write_audit_log();
create trigger audit_tariffs after insert or update or delete on tariffs
  for each row execute function write_audit_log();

-- ---------------------------------------------------------------------------
-- Approval resolution: tally decisions and close the approval out.
-- ---------------------------------------------------------------------------

create or replace function resolve_approval()
returns trigger
language plpgsql
as $$
declare
  v_approval record;
  v_approved int;
  v_rejected int;
begin
  select * into v_approval from approvals where id = new.approval_id;

  select count(*) filter (where decision = 'approved'),
         count(*) filter (where decision = 'rejected')
    into v_approved, v_rejected
    from approval_decisions where approval_id = new.approval_id;

  if v_rejected > 0 then
    update approvals
       set status = 'rejected', approvals_received = v_approved, resolved_at = now()
     where id = new.approval_id and status = 'pending';
  elsif v_approved >= v_approval.required_approvals then
    update approvals
       set status = 'approved', approvals_received = v_approved, resolved_at = now()
     where id = new.approval_id and status = 'pending';
  else
    update approvals set approvals_received = v_approved where id = new.approval_id;
  end if;

  return null;
end;
$$;

create trigger approval_decisions_resolve
  after insert on approval_decisions
  for each row execute function resolve_approval();
