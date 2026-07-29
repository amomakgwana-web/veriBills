import Link from "next/link";

import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import {
  AssignCollectorForm,
  SendReminderButton,
  EscalateToLegalButton,
} from "@/components/estate/arrears-actions";
import {
  Card,
  EmptyState,
  MiniBar,
  PageHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

export const metadata = { title: "Arrears" };

const AGING_BUCKETS = [
  { key: "current_due", label: "Current", className: "bg-brand-400" },
  { key: "overdue_30", label: "1–30 days", className: "bg-brand-600" },
  { key: "overdue_60", label: "31–60 days", className: "bg-yellow-500" },
  { key: "overdue_90", label: "61–90 days", className: "bg-orange-500" },
  { key: "overdue_120_plus", label: "90+ days", className: "bg-red-600" },
] as const;

export default async function ArrearsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [accountsResult, collectorsResult, legalResult] = await Promise.all([
    supabase
      .from("tenant_accounts")
      .select(
        `id, account_number, balance, assigned_collector_id,
         current_due, overdue_30, overdue_60, overdue_90, overdue_120_plus,
         leases(units(unit_number, properties(name)),
                lease_tenants(profile_id, is_primary, profiles(full_name, email)))`,
      )
      .eq("org_id", orgId)
      .eq("is_in_arrears", true)
      .order("balance", { ascending: false })
      .limit(100),
    supabase
      .from("org_members")
      .select("profile_id, profiles!org_members_profile_id_fkey(full_name, email)")
      .eq("org_id", orgId)
      .eq("is_active", true)
      .in("role", ["owner", "admin", "manager", "finance"]),
    supabase
      .from("legal_cases")
      .select("id, stage")
      .eq("org_id", orgId)
      .neq("stage", "resolved"),
  ]);

  const rows = (accountsResult.data ?? []).map((account) => {
    const lease = account.leases as {
      units: { unit_number: string; properties: { name: string } | null } | null;
      lease_tenants: Array<{
        profile_id: string;
        is_primary: boolean;
        profiles: { full_name: string | null; email: string } | null;
      }>;
    } | null;

    const primary = lease?.lease_tenants.find((t) => t.is_primary) ?? lease?.lease_tenants[0];

    return { account, lease, tenant: primary?.profiles ?? null };
  });

  const collectors = (collectorsResult.data ?? [])
    .map((m) => {
      const profile = m.profiles as { full_name: string | null; email: string } | null;
      return profile ? { id: m.profile_id, name: profile.full_name ?? profile.email } : null;
    })
    .filter((c): c is { id: string; name: string } => c !== null);

  const totals = AGING_BUCKETS.reduce<Record<string, number>>((acc, bucket) => {
    acc[bucket.key] = rows.reduce((sum, r) => sum + Number(r.account[bucket.key]), 0);
    return acc;
  }, {});

  const totalOutstanding = Object.values(totals).reduce((s, v) => s + v, 0);
  const severelyOverdue = totals.overdue_90 + totals.overdue_120_plus;
  const unassigned = rows.filter((r) => !r.account.assigned_collector_id).length;
  const openMatters = legalResult.data?.length ?? 0;

  return (
    <>
      <PageHeader
        title="Arrears"
        description="Aging balances and recovery actions across the portfolio"
        action={
          <Link href={`/estate/legal?org=${orgId}`} className="text-brand-700 text-sm font-medium">
            View legal matters →
          </Link>
        }
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Accounts in arrears" value={rows.length} tone={rows.length ? "danger" : "success"} />
        <StatTile label="Total outstanding" value={formatMoney(totalOutstanding)} tone="danger" />
        <StatTile label="61+ days" value={formatMoney(severelyOverdue)} tone="danger" />
        <StatTile label="Open legal matters" value={openMatters} />
      </div>

      <Card className="mb-5" title="Aging breakdown" description="Outstanding balance by days overdue">
        <div className="space-y-3">
          <MiniBar
            segments={AGING_BUCKETS.map((b) => ({
              label: b.label,
              value: totals[b.key],
              className: b.className,
            }))}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {AGING_BUCKETS.map((b) => (
              <div key={b.key}>
                <p className="text-xs text-slate-500">{b.label}</p>
                <p className="tabular text-sm font-semibold text-slate-900">
                  {formatMoney(totals[b.key])}
                </p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card
        title="Accounts in arrears"
        description={`Sorted by balance · ${unassigned} unassigned to a collector`}
      >
        {rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Account</Th>
                <Th>Tenant</Th>
                <Th align="right">Balance</Th>
                <Th align="right">90+ days</Th>
                <Th>Collector</Th>
                <Th>Actions</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ account, lease, tenant }) => (
                <tr key={account.id}>
                  <Td>
                    {account.account_number}
                    <span className="block text-xs text-slate-500">
                      {lease?.units?.unit_number} · {lease?.units?.properties?.name}
                    </span>
                  </Td>
                  <Td>
                    {tenant?.full_name ?? "Unassigned"}
                    <span className="block text-xs text-slate-500">{tenant?.email}</span>
                  </Td>
                  <Td align="right" className="font-medium text-red-600">
                    {formatMoney(account.balance)}
                  </Td>
                  <Td align="right">
                    {formatMoney(Number(account.overdue_90) + Number(account.overdue_120_plus))}
                  </Td>
                  <Td>
                    <AssignCollectorForm
                      orgId={orgId}
                      accountId={account.id}
                      collectorId={account.assigned_collector_id}
                      collectors={collectors}
                    />
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <SendReminderButton orgId={orgId} accountId={account.id} />
                      <EscalateToLegalButton orgId={orgId} accountId={account.id} />
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No accounts in arrears" description="Everyone is up to date." />
        )}
      </Card>
    </>
  );
}
