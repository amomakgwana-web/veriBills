-- Tenants can now request a payment plan themselves (previously only estate
-- staff could propose one). Requests land in the existing approvals
-- workflow rather than becoming active immediately.
--
-- 'requested' is deliberately excluded from payment_plans_tenant_accept's
-- allowed statuses (see 20260726120600_rls_policies.sql) so a tenant cannot
-- self-approve their own request by calling the accept action while it is
-- still pending review.
alter type payment_plan_status add value if not exists 'requested';

-- No approval_policies row existed for any approval type, so every decision
-- silently fell back to {owner,admin} only. Give payment plan requests an
-- explicit policy that also lets a manager vet and approve them.
insert into approval_policies (org_id, type, approver_roles)
select id, 'payment_plan', '{owner,admin,manager}'::org_role[]
from organisations
on conflict (org_id, type) do nothing;
