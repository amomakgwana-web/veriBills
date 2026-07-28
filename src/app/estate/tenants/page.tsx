import Link from "next/link";

import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { RefreshScoresButton } from "@/components/estate/refresh-scores";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Tenants" };

export default async function TenantsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; filter?: string }>;
}) {
  const params = await searchParams;
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [accountsResult, scoresResult] = await Promise.all([
    supabase
      .from("tenant_accounts")
      .select(
        `id, account_number, balance, is_in_arrears, is_on_payment_plan,
         current_due, overdue_30, overdue_60, overdue_90, overdue_120_plus, last_payment_at,
         leases(id, reference, status, start_date, end_date, monthly_rent,
                units(unit_number, type, properties(name)),
                lease_tenants(profile_id, is_primary, profiles(full_name, email, phone)))`,
      )
      .eq("org_id", orgId)
      .order("balance", { ascending: false })
      .limit(200),
    supabase.from("tenant_scores").select("profile_id, score, band").eq("org_id", orgId),
  ]);

  const scores = new Map((scoresResult.data ?? []).map((s) => [s.profile_id, s]));

  const rows = (accountsResult.data ?? []).map((account) => {
    const lease = account.leases as {
      id: string;
      reference: string;
      status: string;
      end_date: string | null;
      monthly_rent: number;
      units: { unit_number: string; type: string; properties: { name: string } | null } | null;
      lease_tenants: Array<{
        profile_id: string;
        is_primary: boolean;
        profiles: { full_name: string | null; email: string; phone: string | null } | null;
      }>;
    } | null;

    const primary = lease?.lease_tenants.find((t) => t.is_primary) ?? lease?.lease_tenants[0];

    return {
      account,
      lease,
      tenant: primary?.profiles ?? null,
      profileId: primary?.profile_id ?? null,
      score: primary ? scores.get(primary.profile_id) : undefined,
    };
  });

  const filtered =
    params.filter === "arrears"
      ? rows.filter((r) => r.account.is_in_arrears)
      : params.filter === "plans"
        ? rows.filter((r) => r.account.is_on_payment_plan)
        : rows;

  const totalOwed = rows.reduce((sum, r) => sum + Math.max(Number(r.account.balance), 0), 0);
  const arrearsCount = rows.filter((r) => r.account.is_in_arrears).length;

  return (
    <>
      <PageHeader
        title="Tenants"
        description="Balances, payment behaviour and arrangements"
        action={<RefreshScoresButton orgId={orgId} />}
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatTile label="Tenants" value={rows.length} />
        <StatTile label="In arrears" value={arrearsCount} tone={arrearsCount ? "danger" : "success"} />
        <StatTile label="Total owed" value={formatMoney(totalOwed)} />
        <StatTile
          label="On payment plans"
          value={rows.filter((r) => r.account.is_on_payment_plan).length}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <FilterChip orgId={orgId} label="All" active={!params.filter} />
        <FilterChip orgId={orgId} filter="arrears" label="In arrears" active={params.filter === "arrears"} />
        <FilterChip orgId={orgId} filter="plans" label="On a plan" active={params.filter === "plans"} />
      </div>

      <Card>
        {filtered.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Tenant</Th>
                <Th>Unit</Th>
                <Th>Account</Th>
                <Th align="right">Balance</Th>
                <Th align="right">90+ days</Th>
                <Th>Score</Th>
                <Th>Lease</Th>
                <Th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ account, lease, tenant, score }) => (
                <tr key={account.id}>
                  <Td>
                    <span className="font-medium text-slate-800 dark:text-slate-200">
                      {tenant?.full_name ?? "Unassigned"}
                    </span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {tenant?.email}
                    </span>
                  </Td>
                  <Td>
                    {lease?.units?.unit_number ?? "—"}
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {lease?.units?.properties?.name}
                    </span>
                  </Td>
                  <Td>{account.account_number}</Td>
                  <Td
                    align="right"
                    className={
                      Number(account.balance) > 0
                        ? "font-medium text-red-600 dark:text-red-400"
                        : "text-brand-600 dark:text-brand-400"
                    }
                  >
                    {formatMoney(account.balance)}
                  </Td>
                  <Td align="right">
                    {formatMoney(
                      Number(account.overdue_90) + Number(account.overdue_120_plus),
                    )}
                  </Td>
                  <Td>
                    {score ? (
                      <Badge
                        tone={
                          score.band === "excellent" || score.band === "good"
                            ? "success"
                            : score.band === "fair"
                              ? "warning"
                              : "danger"
                        }
                      >
                        {score.score} · {humanise(score.band)}
                      </Badge>
                    ) : (
                      <span className="text-xs text-slate-400">Not scored</span>
                    )}
                  </Td>
                  <Td>
                    <span className="text-xs">
                      {lease?.reference}
                      {lease?.end_date && (
                        <span className="block text-slate-400">
                          to{" "}
                          {new Date(lease.end_date).toLocaleDateString("en-ZA", {
                            month: "short",
                            year: "numeric",
                          })}
                        </span>
                      )}
                    </span>
                  </Td>
                  <Td>
                    <Link
                      href={`/estate/tenants/${account.id}?org=${orgId}`}
                      className="text-brand-700 dark:text-brand-400 text-xs font-medium"
                    >
                      Manage
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No tenants match this filter" />
        )}
      </Card>
    </>
  );
}

function FilterChip({
  orgId,
  filter,
  label,
  active,
}: {
  orgId: string;
  filter?: string;
  label: string;
  active: boolean;
}) {
  const href = filter
    ? `/estate/tenants?org=${orgId}&filter=${filter}`
    : `/estate/tenants?org=${orgId}`;

  return (
    <Link
      href={href}
      className={
        active
          ? "bg-brand-700 rounded-full px-2.5 py-1 text-xs font-medium text-white"
          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300"
      }
    >
      {label}
    </Link>
  );
}
