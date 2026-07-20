-- Microsoft (Azure AD) SSO account linking.
--
-- veriBills stays invite-only (Section 3.3: "There is no self-registration
-- path"; staff are "provisioned directly by SysAdmin/IT Admin") even once
-- OAuth is enabled as a *credential method* — SSO must never be able to
-- create a new vb_platform.users row on its own, only attach an Auth
-- identity to a row that already exists. This trigger is how: whenever
-- Supabase Auth creates a new auth.users row (email/password signup,
-- Microsoft OAuth, any future provider — this project's Auth is shared
-- across every product in it, so this fires for all of them), it looks for
-- an unlinked vb_platform.users row with a matching email and links it.
-- If no such row exists — the common case for literally everyone who
-- isn't veriBills staff — this is a harmless no-op.
--
-- The seeded demo accounts (db/006) and activated tenants (db/007) already
-- set auth_user_id at creation time, so this trigger never touches them;
-- it only ever fires for identities that show up with no prior link, which
-- today means: a SysAdmin/Data Admin inserts a vb_platform.users row for a
-- new staff member (auth_user_id left null) ahead of time, and the first
-- time that person signs in — via Microsoft SSO once configured, or
-- email/password — this links it automatically.
create or replace function vb_platform.link_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = vb_platform, pg_catalog, pg_temp
as $$
begin
  update vb_platform.users
  set auth_user_id = new.id
  where email = new.email and auth_user_id is null;
  return new;
end;
$$;

do $$
begin
  if not exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    raise notice 'auth schema not present — skipping OAuth account-linking trigger (not a Supabase-provisioned Postgres)';
    return;
  end if;

  execute 'create or replace trigger vb_link_new_auth_user
    after insert on auth.users
    for each row execute function vb_platform.link_new_auth_user()';
end $$;
