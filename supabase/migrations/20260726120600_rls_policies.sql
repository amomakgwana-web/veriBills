-- veriBills :: 007 row level security
--
-- Model:
--   * system admins (profiles.is_system_admin) see everything
--   * org staff see rows belonging to orgs they are an active member of
--   * tenants see only rows tied to their own leases/units/profile
-- Writes are deliberately narrower than reads. Anything driving money movement
-- (ledger, invoices, collections) is written by SECURITY DEFINER functions or
-- the service role, never directly by a browser session.

alter table organisations            enable row level security;
alter table org_branding             enable row level security;
alter table profiles                 enable row level security;
alter table payment_methods          enable row level security;
alter table org_members              enable row level security;
alter table properties               enable row level security;
alter table units                    enable row level security;
alter table tariffs                  enable row level security;
alter table tariff_blocks            enable row level security;
alter table meters                   enable row level security;
alter table meter_readings           enable row level security;
alter table leases                   enable row level security;
alter table lease_tenants            enable row level security;
alter table lease_charges            enable row level security;
alter table documents                enable row level security;
alter table document_acknowledgements enable row level security;
alter table tenant_accounts          enable row level security;
alter table ledger_entries           enable row level security;
alter table billing_runs             enable row level security;
alter table invoices                 enable row level security;
alter table invoice_lines            enable row level security;
alter table payments                 enable row level security;
alter table payment_allocations      enable row level security;
alter table payment_plans            enable row level security;
alter table payment_plan_instalments enable row level security;
alter table debicheck_mandates       enable row level security;
alter table mandate_events           enable row level security;
alter table collection_runs          enable row level security;
alter table collections              enable row level security;
alter table token_vendors            enable row level security;
alter table electricity_purchases    enable row level security;
alter table usage_baselines          enable row level security;
alter table usage_alerts             enable row level security;
alter table usage_rules              enable row level security;
alter table contractors              enable row level security;
alter table maintenance_requests     enable row level security;
alter table maintenance_comments     enable row level security;
alter table maintenance_status_history enable row level security;
alter table access_codes             enable row level security;
alter table access_events            enable row level security;
alter table facilities               enable row level security;
alter table facility_access_grants   enable row level security;
alter table facility_bookings        enable row level security;
alter table facility_access_events   enable row level security;
alter table announcements            enable row level security;
alter table announcement_reads       enable row level security;
alter table message_templates        enable row level security;
alter table campaigns                enable row level security;
alter table message_deliveries       enable row level security;
alter table unit_applications        enable row level security;
alter table approvals                enable row level security;
alter table approval_decisions       enable row level security;
alter table approval_policies        enable row level security;
alter table bank_accounts            enable row level security;
alter table tenant_scores            enable row level security;
alter table audit_logs               enable row level security;
alter table integrations             enable row level security;
alter table system_health_checks     enable row level security;
alter table webhook_events           enable row level security;
alter table accounting_exports       enable row level security;
alter table chat_conversations       enable row level security;
alter table chat_messages            enable row level security;
alter table document_sequences       enable row level security;

-- ---------------------------------------------------------------------------
-- Identity
-- ---------------------------------------------------------------------------

create policy profiles_select_self on profiles for select
  using (id = auth.uid() or is_system_admin());

-- Staff can read profiles of people tied to their org (tenants, colleagues).
create policy profiles_select_org on profiles for select
  using (
    exists (
      select 1 from lease_tenants lt
       join leases l on l.id = lt.lease_id
      where lt.profile_id = profiles.id and has_org_access(l.org_id)
    )
    or exists (
      select 1 from org_members m
      where m.profile_id = profiles.id and has_org_access(m.org_id)
    )
  );

create policy profiles_update_self on profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

create policy profiles_admin_all on profiles for all
  using (is_system_admin()) with check (is_system_admin());

create policy payment_methods_own on payment_methods for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy organisations_select on organisations for select
  using (has_org_access(id) or id in (
    select l.org_id from leases l where l.id in (select current_lease_ids())
  ));

create policy organisations_manage on organisations for all
  using (has_org_role(id, '{owner,admin}')) with check (has_org_role(id, '{owner,admin}'));

create policy org_branding_select on org_branding for select
  using (has_org_access(org_id) or org_id in (
    select l.org_id from leases l where l.id in (select current_lease_ids())
  ));

create policy org_branding_manage on org_branding for all
  using (has_org_role(org_id, '{owner,admin}')) with check (has_org_role(org_id, '{owner,admin}'));

create policy org_members_select on org_members for select
  using (profile_id = auth.uid() or has_org_access(org_id));

create policy org_members_manage on org_members for all
  using (has_org_role(org_id, '{owner,admin}')) with check (has_org_role(org_id, '{owner,admin}'));

-- ---------------------------------------------------------------------------
-- Portfolio
-- ---------------------------------------------------------------------------

create policy properties_select on properties for select
  using (has_org_access(org_id) or id in (select current_property_ids()));

create policy properties_manage on properties for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy units_select on units for select
  using (has_org_access(org_id) or id in (select current_unit_ids()));

create policy units_manage on units for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy tariffs_select on tariffs for select
  using (has_org_access(org_id) or org_id in (
    select l.org_id from leases l where l.id in (select current_lease_ids())
  ));

create policy tariffs_manage on tariffs for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy tariff_blocks_select on tariff_blocks for select
  using (exists (select 1 from tariffs t where t.id = tariff_id));

create policy tariff_blocks_manage on tariff_blocks for all
  using (exists (select 1 from tariffs t where t.id = tariff_id and has_org_role(t.org_id, '{owner,admin,finance}')))
  with check (exists (select 1 from tariffs t where t.id = tariff_id and has_org_role(t.org_id, '{owner,admin,finance}')));

create policy meters_select on meters for select
  using (has_org_access(org_id) or unit_id in (select current_unit_ids()));

create policy meters_manage on meters for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy meter_readings_select on meter_readings for select
  using (
    has_org_access(org_id)
    or exists (select 1 from meters m where m.id = meter_id and m.unit_id in (select current_unit_ids()))
  );

-- Tenants may submit their own reading; staff can capture any.
create policy meter_readings_insert on meter_readings for insert
  with check (
    has_org_access(org_id)
    or (
      source = 'tenant_submitted'
      and read_by = auth.uid()
      and exists (select 1 from meters m where m.id = meter_id and m.unit_id in (select current_unit_ids()))
    )
  );

-- ---------------------------------------------------------------------------
-- Leases and documents
-- ---------------------------------------------------------------------------

create policy leases_select on leases for select
  using (has_org_access(org_id) or id in (select current_lease_ids()));

create policy leases_manage on leases for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy lease_tenants_select on lease_tenants for select
  using (
    profile_id = auth.uid()
    or lease_id in (select current_lease_ids())
    or exists (select 1 from leases l where l.id = lease_id and has_org_access(l.org_id))
  );

create policy lease_tenants_manage on lease_tenants for all
  using (exists (select 1 from leases l where l.id = lease_id and has_org_role(l.org_id, '{owner,admin,manager}')))
  with check (exists (select 1 from leases l where l.id = lease_id and has_org_role(l.org_id, '{owner,admin,manager}')));

create policy lease_charges_select on lease_charges for select
  using (has_org_access(org_id) or lease_id in (select current_lease_ids()));

create policy lease_charges_manage on lease_charges for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy documents_select on documents for select
  using (
    has_org_access(org_id)
    or (tenant_visible and (
         profile_id = auth.uid()
         or lease_id in (select current_lease_ids())
         or unit_id in (select current_unit_ids())
         -- Estate-wide policies: no lease/unit/profile pin, org must match.
         or (lease_id is null and unit_id is null and profile_id is null
             and property_id in (select current_property_ids()))
       ))
  );

create policy documents_manage on documents for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

-- Tenants upload their own supporting documents (ID, payslip, statement).
create policy documents_tenant_insert on documents for insert
  with check (
    profile_id = auth.uid()
    and uploaded_by = auth.uid()
    and type in ('id_copy', 'payslip', 'bank_statement', 'proof_of_address', 'other')
  );

create policy document_ack_select on document_acknowledgements for select
  using (
    profile_id = auth.uid()
    or exists (select 1 from documents d where d.id = document_id and has_org_access(d.org_id))
  );

create policy document_ack_insert on document_acknowledgements for insert
  with check (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Money. Reads are scoped; writes go through functions/service role.
-- ---------------------------------------------------------------------------

create policy tenant_accounts_select on tenant_accounts for select
  using (has_org_access(org_id) or lease_id in (select current_lease_ids()));

create policy tenant_accounts_manage on tenant_accounts for update
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy ledger_entries_select on ledger_entries for select
  using (has_org_access(org_id) or account_id in (select current_account_ids()));

create policy billing_runs_select on billing_runs for select
  using (has_org_access(org_id));

create policy billing_runs_manage on billing_runs for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy invoices_select on invoices for select
  using (has_org_access(org_id) or account_id in (select current_account_ids()));

create policy invoices_manage on invoices for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy invoice_lines_select on invoice_lines for select
  using (exists (
    select 1 from invoices i
     where i.id = invoice_id
       and (has_org_access(i.org_id) or i.account_id in (select current_account_ids()))
  ));

create policy invoice_lines_manage on invoice_lines for all
  using (exists (select 1 from invoices i where i.id = invoice_id and has_org_role(i.org_id, '{owner,admin,finance}')))
  with check (exists (select 1 from invoices i where i.id = invoice_id and has_org_role(i.org_id, '{owner,admin,finance}')));

create policy payments_select on payments for select
  using (
    has_org_access(org_id)
    or profile_id = auth.uid()
    or account_id in (select current_account_ids())
  );

-- A tenant may start a payment for their own account; status transitions are
-- driven server-side after the gateway responds.
create policy payments_tenant_insert on payments for insert
  with check (
    profile_id = auth.uid()
    and status = 'initiated'
    and (account_id is null or account_id in (select current_account_ids()))
  );

create policy payments_staff_manage on payments for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy payment_allocations_select on payment_allocations for select
  using (exists (
    select 1 from payments p
     where p.id = payment_id
       and (has_org_access(p.org_id) or p.profile_id = auth.uid() or p.account_id in (select current_account_ids()))
  ));

create policy payment_plans_select on payment_plans for select
  using (has_org_access(org_id) or account_id in (select current_account_ids()));

create policy payment_plans_manage on payment_plans for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

-- Tenant accepting a plan proposed to them.
create policy payment_plans_tenant_accept on payment_plans for update
  using (account_id in (select current_account_ids()) and status in ('proposed', 'awaiting_acceptance'))
  with check (account_id in (select current_account_ids()));

create policy payment_plan_instalments_select on payment_plan_instalments for select
  using (exists (
    select 1 from payment_plans pp
     where pp.id = plan_id
       and (has_org_access(pp.org_id) or pp.account_id in (select current_account_ids()))
  ));

create policy payment_plan_instalments_manage on payment_plan_instalments for all
  using (exists (select 1 from payment_plans pp where pp.id = plan_id and has_org_role(pp.org_id, '{owner,admin,finance}')))
  with check (exists (select 1 from payment_plans pp where pp.id = plan_id and has_org_role(pp.org_id, '{owner,admin,finance}')));

create policy mandates_select on debicheck_mandates for select
  using (has_org_access(org_id) or profile_id = auth.uid() or account_id in (select current_account_ids()));

create policy mandates_manage on debicheck_mandates for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy mandate_events_select on mandate_events for select
  using (exists (
    select 1 from debicheck_mandates m
     where m.id = mandate_id and (has_org_access(m.org_id) or m.profile_id = auth.uid())
  ));

create policy collection_runs_select on collection_runs for select
  using (has_org_access(org_id));

create policy collection_runs_manage on collection_runs for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy collections_select on collections for select
  using (has_org_access(org_id) or account_id in (select current_account_ids()));

create policy collections_manage on collections for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

-- ---------------------------------------------------------------------------
-- Utilities
-- ---------------------------------------------------------------------------

create policy token_vendors_select on token_vendors for select
  using (org_id is null or has_org_access(org_id));

create policy token_vendors_manage on token_vendors for all
  using (is_system_admin() or has_org_role(org_id, '{owner,admin}'))
  with check (is_system_admin() or has_org_role(org_id, '{owner,admin}'));

create policy electricity_select on electricity_purchases for select
  using (has_org_access(org_id) or profile_id = auth.uid() or unit_id in (select current_unit_ids()));

create policy electricity_tenant_insert on electricity_purchases for insert
  with check (profile_id = auth.uid() and unit_id in (select current_unit_ids()) and status = 'pending');

create policy electricity_staff_manage on electricity_purchases for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

create policy usage_baselines_select on usage_baselines for select
  using (has_org_access(org_id) or unit_id in (select current_unit_ids()));

create policy usage_alerts_select on usage_alerts for select
  using (has_org_access(org_id) or unit_id in (select current_unit_ids()));

create policy usage_alerts_manage on usage_alerts for update
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy usage_rules_select on usage_rules for select
  using (has_org_access(org_id));

create policy usage_rules_manage on usage_rules for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

-- ---------------------------------------------------------------------------
-- Maintenance
-- ---------------------------------------------------------------------------

create policy contractors_select on contractors for select
  using (has_org_access(org_id));

create policy contractors_manage on contractors for all
  using (has_org_role(org_id, '{owner,admin,manager,maintenance}'))
  with check (has_org_role(org_id, '{owner,admin,manager,maintenance}'));

create policy maintenance_select on maintenance_requests for select
  using (
    has_org_access(org_id)
    or reported_by = auth.uid()
    or unit_id in (select current_unit_ids())
  );

create policy maintenance_tenant_insert on maintenance_requests for insert
  with check (
    reported_by = auth.uid()
    and unit_id in (select current_unit_ids())
    and status = 'logged'
  );

-- Tenants can rate and close out their own request; staff manage everything.
create policy maintenance_tenant_update on maintenance_requests for update
  using (reported_by = auth.uid() and status not in ('closed'))
  with check (reported_by = auth.uid());

create policy maintenance_staff_manage on maintenance_requests for all
  using (has_org_role(org_id, '{owner,admin,manager,maintenance}'))
  with check (has_org_role(org_id, '{owner,admin,manager,maintenance}'));

create policy maintenance_comments_select on maintenance_comments for select
  using (exists (
    select 1 from maintenance_requests r
     where r.id = request_id
       and (
         has_org_access(r.org_id)
         or (not maintenance_comments.is_internal
             and (r.reported_by = auth.uid() or r.unit_id in (select current_unit_ids())))
       )
  ));

create policy maintenance_comments_insert on maintenance_comments for insert
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from maintenance_requests r
       where r.id = request_id
         and (has_org_access(r.org_id) or r.reported_by = auth.uid() or r.unit_id in (select current_unit_ids()))
    )
    -- Only staff may write internal notes.
    and (not is_internal or exists (
      select 1 from maintenance_requests r where r.id = request_id and has_org_access(r.org_id)
    ))
  );

create policy maintenance_history_select on maintenance_status_history for select
  using (exists (
    select 1 from maintenance_requests r
     where r.id = request_id
       and (has_org_access(r.org_id) or r.reported_by = auth.uid() or r.unit_id in (select current_unit_ids()))
  ));

-- ---------------------------------------------------------------------------
-- Access control and facilities
-- ---------------------------------------------------------------------------

create policy access_codes_select on access_codes for select
  using (has_org_access(org_id) or issued_by = auth.uid() or unit_id in (select current_unit_ids()));

create policy access_codes_tenant_insert on access_codes for insert
  with check (issued_by = auth.uid() and unit_id in (select current_unit_ids()));

create policy access_codes_tenant_revoke on access_codes for update
  using (issued_by = auth.uid()) with check (issued_by = auth.uid());

create policy access_codes_staff_manage on access_codes for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy access_events_select on access_events for select
  using (
    has_org_access(org_id)
    or exists (select 1 from access_codes c where c.id = access_code_id and c.issued_by = auth.uid())
  );

create policy facilities_select on facilities for select
  using (has_org_access(org_id) or property_id in (select current_property_ids()));

create policy facilities_manage on facilities for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy facility_grants_select on facility_access_grants for select
  using (has_org_access(org_id) or profile_id = auth.uid());

create policy facility_grants_manage on facility_access_grants for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy facility_bookings_select on facility_bookings for select
  using (has_org_access(org_id) or profile_id = auth.uid());

create policy facility_bookings_tenant on facility_bookings for insert
  with check (profile_id = auth.uid() and facility_id in (
    select f.id from facilities f where f.property_id in (select current_property_ids())
  ));

create policy facility_bookings_tenant_update on facility_bookings for update
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy facility_bookings_staff on facility_bookings for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy facility_events_select on facility_access_events for select
  using (has_org_access(org_id) or profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Communications
-- ---------------------------------------------------------------------------

create policy announcements_select on announcements for select
  using (
    has_org_access(org_id)
    or (
      publish_at <= now()
      and (expires_at is null or expires_at > now())
      and (property_id is null or property_id in (select current_property_ids()))
      and org_id in (select l.org_id from leases l where l.id in (select current_lease_ids()))
    )
  );

create policy announcements_manage on announcements for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy announcement_reads_own on announcement_reads for all
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create policy message_templates_select on message_templates for select
  using (has_org_access(org_id));

create policy message_templates_manage on message_templates for all
  using (has_org_role(org_id, '{owner,admin}'))
  with check (has_org_role(org_id, '{owner,admin}'));

create policy campaigns_select on campaigns for select
  using (has_org_access(org_id));

create policy campaigns_manage on campaigns for all
  using (has_org_role(org_id, '{owner,admin,manager,finance}'))
  with check (has_org_role(org_id, '{owner,admin,manager,finance}'));

create policy deliveries_select on message_deliveries for select
  using (has_org_access(org_id) or profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Applications and approvals
-- ---------------------------------------------------------------------------

create policy applications_select on unit_applications for select
  using (has_org_access(org_id) or applicant_id = auth.uid());

create policy applications_insert on unit_applications for insert
  with check (applicant_id = auth.uid() and status = 'submitted');

create policy applications_applicant_update on unit_applications for update
  using (applicant_id = auth.uid() and status in ('submitted', 'documents_requested'))
  with check (applicant_id = auth.uid());

create policy applications_staff on unit_applications for all
  using (has_org_role(org_id, '{owner,admin,manager}'))
  with check (has_org_role(org_id, '{owner,admin,manager}'));

create policy approvals_select on approvals for select
  using (has_org_access(org_id) or requested_by = auth.uid());

create policy approvals_manage on approvals for all
  using (has_org_role(org_id, '{owner,admin,manager,finance}'))
  with check (has_org_role(org_id, '{owner,admin,manager,finance}'));

create policy approval_decisions_select on approval_decisions for select
  using (exists (select 1 from approvals a where a.id = approval_id and has_org_access(a.org_id)));

-- Only a member holding one of the approver roles may decide.
create policy approval_decisions_insert on approval_decisions for insert
  with check (
    decided_by = auth.uid()
    and exists (
      select 1 from approvals a
       left join approval_policies ap on ap.org_id = a.org_id and ap.type = a.type
      where a.id = approval_id
        and a.status = 'pending'
        and has_org_role(a.org_id, coalesce(ap.approver_roles, '{owner,admin}'::org_role[]))
    )
  );

create policy approval_policies_select on approval_policies for select
  using (has_org_access(org_id));

create policy approval_policies_manage on approval_policies for all
  using (has_org_role(org_id, '{owner,admin}'))
  with check (has_org_role(org_id, '{owner,admin}'));

create policy bank_accounts_select on bank_accounts for select
  using (has_org_role(org_id, '{owner,admin,finance}'));

create policy bank_accounts_manage on bank_accounts for all
  using (has_org_role(org_id, '{owner,admin}'))
  with check (has_org_role(org_id, '{owner,admin}'));

create policy tenant_scores_select on tenant_scores for select
  using (has_org_access(org_id) or profile_id = auth.uid());

create policy tenant_scores_manage on tenant_scores for all
  using (has_org_role(org_id, '{owner,admin,finance}'))
  with check (has_org_role(org_id, '{owner,admin,finance}'));

-- ---------------------------------------------------------------------------
-- Audit and system. Audit logs are read-only to everyone; only the service
-- role (which bypasses RLS) and the SECURITY DEFINER trigger write them.
-- ---------------------------------------------------------------------------

create policy audit_logs_select on audit_logs for select
  using (has_org_role(org_id, '{owner,admin}') or is_system_admin());

create policy integrations_select on integrations for select
  using (is_system_admin() or has_org_role(org_id, '{owner,admin}'));

create policy integrations_manage on integrations for all
  using (is_system_admin() or has_org_role(org_id, '{owner,admin}'))
  with check (is_system_admin() or has_org_role(org_id, '{owner,admin}'));

create policy health_select on system_health_checks for select
  using (is_system_admin());

create policy webhook_events_select on webhook_events for select
  using (is_system_admin());

create policy accounting_exports_select on accounting_exports for select
  using (is_system_admin() or has_org_role(org_id, '{owner,admin,finance}'));

create policy accounting_exports_manage on accounting_exports for all
  using (is_system_admin() or has_org_role(org_id, '{owner,admin,finance}'))
  with check (is_system_admin() or has_org_role(org_id, '{owner,admin,finance}'));

create policy document_sequences_select on document_sequences for select
  using (has_org_access(org_id));

-- ---------------------------------------------------------------------------
-- Chatbot
-- ---------------------------------------------------------------------------

create policy chat_conversations_own on chat_conversations for all
  using (profile_id = auth.uid() or has_org_access(org_id))
  with check (profile_id = auth.uid() or has_org_access(org_id));

create policy chat_messages_select on chat_messages for select
  using (exists (
    select 1 from chat_conversations c
     where c.id = conversation_id and (c.profile_id = auth.uid() or has_org_access(c.org_id))
  ));

create policy chat_messages_insert on chat_messages for insert
  with check (exists (
    select 1 from chat_conversations c
     where c.id = conversation_id and (c.profile_id = auth.uid() or has_org_access(c.org_id))
  ));
