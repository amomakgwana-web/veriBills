import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { PlanStatusButtons } from "@/components/estate/plan-status-buttons";
import {
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  StatusBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

export const metadata = { title: "Payment plans" };

export default async function PaymentPlansPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [plansResult, instalmentsResult] = await Promise.all([
    supabase
      .from("payment_plans")
      .select(
        `id, reference, status, arrears_amount, instalment_amount, instalment_count,
         amount_paid, first_due_date, created_at,
         tenant_accounts(account_number,
           leases(lease_tenants(profile_id, is_primary, profiles(full_name, email))))`,
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(200),
    supabase
      .from("payment_plan_instalments")
      .select("status, plan_id, payment_plans!inner(org_id)")
      .eq("payment_plans.org_id", orgId),
  ]);

  const plans = plansResult.data ?? [];
  const instalments = instalmentsResult.data ?? [];

  const active = plans.filter((p) => p.status === "active");
  const completed = plans.filter((p) => p.status === "completed");
  const pending = plans.filter((p) => ["requested", "proposed", "awaiting_acceptance"].includes(p.status));

  const tenored = [...active, ...completed];
  const avgTenor = tenored.length
    ? tenored.reduce((sum, p) => sum + p.instalment_count, 0) / tenored.length
    : 0;

  const paidInstalments = instalments.filter((i) => i.status === "paid").length;
  const missedInstalments = instalments.filter((i) => i.status === "missed").length;
  const adherenceBase = paidInstalments + missedInstalments;
  const adherenceRate = adherenceBase > 0 ? (paidInstalments / adherenceBase) * 100 : null;

  const valueUnderPlan = active.reduce((sum, p) => {
    const total = Number(p.instalment_amount) * p.instalment_count;
    return sum + Math.max(total - Number(p.amount_paid), 0);
  }, 0);

  return (
    <>
      <PageHeader title="Payment plans" description="Arrears arrangements across the portfolio" />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Active plans" value={active.length} />
        <StatTile label="Pending" value={pending.length} tone={pending.length ? "warning" : "success"} />
        <StatTile label="Avg. tenor" value={avgTenor ? `${avgTenor.toFixed(1)} mo` : "—"} />
        <StatTile
          label="Adherence rate"
          value={adherenceRate !== null ? `${adherenceRate.toFixed(0)}%` : "—"}
          tone={adherenceRate === null ? "neutral" : adherenceRate >= 80 ? "success" : adherenceRate >= 50 ? "warning" : "danger"}
        />
        <StatTile label="Value under plan" value={formatMoney(valueUnderPlan)} />
      </div>

      <Card title="All plans">
        {plans.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Tenant</Th>
                <Th align="right">Arrears</Th>
                <Th align="right">Instalment</Th>
                <Th align="right">Paid</Th>
                <Th>Status</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => {
                const account = plan.tenant_accounts as {
                  account_number: string;
                  leases: {
                    lease_tenants: Array<{
                      profile_id: string;
                      is_primary: boolean;
                      profiles: { full_name: string | null; email: string } | null;
                    }>;
                  } | null;
                } | null;

                const lease = account?.leases;
                const primary = lease?.lease_tenants.find((t) => t.is_primary) ?? lease?.lease_tenants[0];

                return (
                  <tr key={plan.id}>
                    <Td className="mono">{plan.reference}</Td>
                    <Td>
                      {primary?.profiles?.full_name ?? account?.account_number ?? "—"}
                      <span className="block text-xs text-slate-500">{account?.account_number}</span>
                    </Td>
                    <Td align="right">{formatMoney(plan.arrears_amount)}</Td>
                    <Td align="right">
                      {formatMoney(plan.instalment_amount)} × {plan.instalment_count}
                    </Td>
                    <Td align="right">{formatMoney(plan.amount_paid)}</Td>
                    <Td>
                      <StatusBadge status={plan.status} />
                    </Td>
                    <Td>
                      <PlanStatusButtons orgId={orgId} planId={plan.id} status={plan.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="No payment plans yet"
            description="Propose one from a tenant's page, or a tenant can request one from their portal."
          />
        )}
      </Card>
    </>
  );
}
