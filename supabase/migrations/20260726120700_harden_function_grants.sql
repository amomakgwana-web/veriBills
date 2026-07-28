-- veriBills :: 008 lock down the RPC surface
--
-- Postgres grants EXECUTE to PUBLIC on every new function, and PUBLIC covers
-- both anon and authenticated. Supabase exposes public-schema functions over
-- /rest/v1/rpc, so without this migration privileged routines such as
-- run_billing, settle_payment and redeem_access_code are callable by an
-- unauthenticated caller. Revoking from anon/authenticated alone is not enough,
-- because the inherited PUBLIC grant remains.

-- Pin search_path on the functions that were still resolving it at call time.
alter function set_updated_at() set search_path = public;
alter function apply_ledger_entry() set search_path = public;
alter function reject_ledger_mutation() set search_path = public;
alter function assign_invoice_number() set search_path = public;
alter function recalc_invoice_totals() set search_path = public;
alter function sync_invoice_status() set search_path = public;
alter function ensure_tenant_account() set search_path = public;
alter function derive_reading_consumption() set search_path = public;
alter function refresh_meter_last_reading() set search_path = public;
alter function calculate_tariff_cost(uuid, numeric) set search_path = public;
alter function units_for_amount(uuid, numeric) set search_path = public;
alter function resolve_approval() set search_path = public;

revoke execute on all functions in schema public from public, anon, authenticated;
alter default privileges in schema public revoke execute on functions from public;

-- Scoping helpers must stay callable: RLS policies invoke them as the calling
-- role, and each only ever reports the caller's own access.
grant execute on function is_system_admin() to authenticated;
grant execute on function has_org_access(uuid) to authenticated;
grant execute on function has_org_role(uuid, org_role[]) to authenticated;
grant execute on function current_org_ids() to authenticated;
grant execute on function current_lease_ids() to authenticated;
grant execute on function current_unit_ids() to authenticated;
grant execute on function current_account_ids() to authenticated;
grant execute on function current_property_ids() to authenticated;

-- Read-only tariff maths, used to quote kWh before a prepaid purchase.
grant execute on function calculate_tariff_cost(uuid, numeric) to authenticated;
grant execute on function units_for_amount(uuid, numeric) to authenticated;

-- Everything else -- run_billing, settle_payment, redeem_access_code,
-- next_sequence_number, refresh_account_ageing, refresh_usage_baseline,
-- compute_tenant_score, check_facility_access and the trigger functions --
-- is reachable only through the service role from server-side code.
