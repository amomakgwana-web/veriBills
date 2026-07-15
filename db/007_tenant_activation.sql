-- Tenant activation (Section 3.3, step 4: "The tenant confirms their
-- details and sets their own credentials"). This is the DB-side half of
-- the activate-tenant Edge Function — the two-step split exists because
-- creating a Supabase Auth user needs the Auth admin API (service_role
-- key, only callable from Deno/a server context), while everything else
-- (validating the invite, creating the tenant's vb_platform.users row,
-- linking the lease, marking the invite used) is ordinary SQL.
--
-- Restricted to service_role only — unlike every other RPC in db/005,
-- there's no authenticated caller yet at this point (the tenant has no
-- session until *after* activation succeeds), so this can't be gated by
-- vb_platform.current_role() the way the rest of Stage 2 is. The token
-- itself is what a legitimate caller proves knowledge of; the Edge
-- Function is the only trusted caller, invoked with the service_role key
-- after it has already created the Auth user.
create or replace function public.vb_complete_tenant_activation(p_token text, p_name text, p_auth_user_id uuid)
returns vb_platform.users
language plpgsql
security definer
set search_path = vb_platform, pg_catalog, pg_temp
as $$
declare
  v_invite vb_platform.tenant_invites;
  v_user_id text;
  v_row vb_platform.users;
begin
  select * into v_invite from vb_platform.tenant_invites where token = p_token and status = 'pending';
  if v_invite.id is null then
    raise exception 'Invite not found or already used' using errcode = 'P0002';
  end if;
  if exists (select 1 from vb_platform.users where auth_user_id = p_auth_user_id) then
    raise exception 'This identity is already linked to a platform user' using errcode = '23505';
  end if;

  v_user_id := 'TENANT-' || public._vb_next_seq('vb_platform', 'users');
  insert into vb_platform.users (id, email, name, auth_user_id, role, tenant_unit_id)
  values (v_user_id, v_invite.email, p_name, p_auth_user_id, 'tenant', v_invite.unit_id)
  returning * into v_row;

  update vb_platform.leases set tenant_user_id = v_user_id where id = v_invite.lease_id;
  update vb_platform.tenant_invites set status = 'activated', activated_at = now() where id = v_invite.id;

  perform public._vb_append_event('tenant.activated', 'xbilling', jsonb_build_object('unitId', v_invite.unit_id, 'userId', v_user_id));
  return v_row;
end;
$$;
revoke execute on function public.vb_complete_tenant_activation(text, text, uuid) from public;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'grant execute on function public.vb_complete_tenant_activation(text, text, uuid) to service_role';
  end if;
end $$;
