-- Demo data — one estate, two units, and five demo logins spanning both
-- the tenant-facing and back-office sides (tenant, sysadmin, landlord,
-- estate_manager, it_admin), so there's something to actually sign in as
-- before the invite/activation Edge Function (which is how every real
-- tenant account gets created) exists. data_admin/data_analyst/
-- compliance_officer aren't seeded here — add them the same way once
-- needed.
--
-- Follows the exact seeding pattern the sibling xBilling-xUtilities repo's
-- db/010 established: insert directly into auth.users/auth.identities with
-- a bcrypt-hashed password via pgcrypto, then link vb_platform.users.
-- Guarded to no-op on bare Postgres (CI, local dev without the Supabase
-- CLI stack) the same way.

create extension if not exists pgcrypto;

insert into vb_platform.estates (id, name, address, contact_email, contact_phone)
values ('EST-001', 'Riverside Estate', '12 Riverside Drive', 'estate@veribills.demo', '+27110000000')
on conflict (id) do nothing;

insert into vb_platform.units (id, estate_id, unit_number)
values ('UNIT-001', 'EST-001', '1A'), ('UNIT-002', 'EST-001', '1B')
on conflict (id) do nothing;

do $$
declare
  r record;
  new_id uuid;
  pw text;
  v_role text;
  v_email text;
  v_name text;
  v_id text;
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise notice 'auth schema not present — skipping demo user seeding (not a Supabase-provisioned Postgres)';
    return;
  end if;

  for r in select * from (values
    ('DEMO-SYSADMIN', 'sysadmin@veribills.demo', 'Demo SysAdmin', 'sysadmin', 'SysAdmin!2026'),
    ('DEMO-LANDLORD', 'landlord@veribills.demo', 'Demo Landlord', 'landlord', 'Landlord!2026'),
    ('DEMO-ESTATEMGR', 'estatemanager@veribills.demo', 'Demo Estate Manager', 'estate_manager', 'EstateManager!2026'),
    ('DEMO-TENANT', 'tenant@veribills.demo', 'Demo Tenant', 'tenant', 'Tenant!2026'),
    ('DEMO-ITADMIN', 'itadmin@veribills.demo', 'Demo IT Admin', 'it_admin', 'ItAdmin!2026')
  ) as t(id, email, name, role, password)
  loop
    if exists (select 1 from vb_platform.users where id = r.id) then
      continue;
    end if;

    new_id := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000', new_id, 'authenticated', 'authenticated',
      r.email, crypt(r.password, gen_salt('bf')),
      now(), '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb,
      now(), now(), '', '', '', ''
    );
    insert into auth.identities (id, user_id, provider_id, identity_data, provider, created_at, updated_at)
    values (
      gen_random_uuid(), new_id, new_id::text,
      jsonb_build_object('sub', new_id::text, 'email', r.email),
      'email', now(), now()
    );

    insert into vb_platform.users (id, email, name, auth_user_id, role)
    values (r.id, r.email, r.name, new_id, r.role);
  end loop;

  update vb_platform.users set tenant_unit_id = 'UNIT-001' where id = 'DEMO-TENANT';

  insert into vb_platform.landlord_estates (user_id, estate_id)
  select 'DEMO-LANDLORD', 'EST-001'
  where not exists (select 1 from vb_platform.landlord_estates where user_id = 'DEMO-LANDLORD' and estate_id = 'EST-001');

  insert into vb_platform.estate_manager_estates (user_id, estate_id)
  select 'DEMO-ESTATEMGR', 'EST-001'
  where not exists (select 1 from vb_platform.estate_manager_estates where user_id = 'DEMO-ESTATEMGR' and estate_id = 'EST-001');

  if not exists (select 1 from vb_platform.leases where unit_id = 'UNIT-001' and status = 'active') then
    insert into vb_platform.leases (id, unit_id, tenant_user_id, rent_amount, start_date, status)
    values ('LEASE-001', 'UNIT-001', 'DEMO-TENANT', 8500, current_date, 'active');
  end if;
end $$;
