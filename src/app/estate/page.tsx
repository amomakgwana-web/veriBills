import Link from "next/link";

import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/domain/money";
import {
  Badge,
  Card,
  EmptyState,
  MiniBar,
  PageHeader,
  StatTile,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Estate dashboard" };

export default async function EstateDashboard({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  const [
    accounts,
    units,
    payments,
    invoices,
    alerts,
    maintenance,
    approvals,
    mandates,
    plans,
    electricity,
    accessEvents,
    deliveries,
  ] = await Promise.all([
    supabase.from("tenant_accounts").select("id, balance, is_in_arrears, current_due, overdue_30, overdue_60, overdue_90, overdue_120_plus").eq("org_id", orgId),
    supabase.from("units").select("id, status").eq("org_id", orgId),
    supabase
      .from("payments")
      .select("id, amount, status, method, created_at")
      .eq("org_id", orgId)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("invoices")
      .select("id, total, amount_due, status")
      .eq("org_id", orgId)
      .gte("period_start", monthStart.toISOString().slice(0, 10)),
    supabase
      .from("usage_alerts")
      .select("id, title, detail, severity, utility, deviation_percent, created_at, units(unit_number)")
      .eq("org_id", orgId)
      .eq("is_acknowledged", false)
      .order("deviation_percent", { ascending: false })
      .limit(5),
    supabase
      .from("maintenance_requests")
      .select("id, reference, title, status, priority, created_at, units(unit_number)")
      .eq("org_id", orgId)
      .not("status", "in", "(closed,resolved)")
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("approvals")
      .select("id, type, title, amount, status, created_at")
      .eq("org_id", orgId)
      .eq("status", "pending")
      .limit(5),
    supabase.from("debicheck_mandates").select("id, status").eq("org_id", orgId),
    supabase.from("payment_plans").select("id, status").eq("org_id", orgId),
    supabase
      .from("electricity_purchases")
      .select("gross_amount, units_kwh, status")
      .eq("org_id", orgId)
      .gte("created_at", monthStart.toISOString()),
    supabase
      .from("access_events")
      .select("id, result")
      .eq("org_id", orgId)
      .gte("occurred_at", monthStart.toISOString()),
    supabase
      .from("message_deliveries")
      .select("id, status, channel")
      .eq("org_id", orgId)
      .gte("created_at", monthStart.toISOString()),
  ]);

  const accountRows = accounts.data ?? [];
  const totalOwed = accountRows.reduce((sum, a) => sum + Math.max(Number(a.balance), 0), 0);
  const inArrears = accountRows.filter((a) => a.is_in_arrears).length;

  const ageing = accountRows.reduce(
    (acc, a) => {
      acc.current += Number(a.current_due);
      acc.d30 += Number(a.overdue_30);
      acc.d60 += Number(a.overdue_60);
      acc.d90 += Number(a.overdue_90);
      acc.d120 += Number(a.overdue_120_plus);
      return acc;
    },
    { current: 0, d30: 0, d60: 0, d90: 0, d120: 0 },
  );

  const collected = (payments.data ?? [])
    .filter((p) => ["captured", "settled"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const billed = (invoices.data ?? []).reduce((sum, i) => sum + Number(i.total), 0);
  const collectionRate = billed > 0 ? (collected / billed) * 100 : 0;

  const occupied = (units.data ?? []).filter((u) => u.status === "occupied").length;
  const totalUnits = units.data?.length ?? 0;

  const activeMandates = (mandates.data ?? []).filter((m) =>
    ["active", "authenticated"].includes(m.status),
  ).length;
  const activePlans = (plans.data ?? []).filter((p) => p.status === "active").length;

  const electricitySpend = (electricity.data ?? []).reduce(
    (sum, e) => sum + Number(e.gross_amount),
    0,
  );
  const electricityUnits = (electricity.data ?? []).reduce(
    (sum, e) => sum + Number(e.units_kwh ?? 0),
    0,
  );

  const gateGranted = (accessEvents.data ?? []).filter((e) => e.result === "granted").length;
  const gateDenied = (accessEvents.data ?? []).length - gateGranted;

  const delivered = (deliveries.data ?? []).filter((d) =>
    ["sent", "delivered", "opened", "clicked"].includes(d.status),
  ).length;
  const deliveryFailed = (deliveries.data ?? []).filter((d) =>
    ["failed", "bounced"].includes(d.status),
  ).length;

  return (
    <>
      <PageHeader
        title={membership.orgName}
        description="Portfolio performance this month"
      />

      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Outstanding"
          value={formatMoney(totalOwed)}
          hint={`${inArrears} of ${accountRows.length} accounts in arrears`}
          tone={inArrears > 0 ? "danger" : "success"}
        />
        <StatTile
          label="Collected this month"
          value={formatMoney(collected)}
          hint={`${formatNumber(collectionRate, 0)}% of billed`}
          tone={collectionRate >= 90 ? "success" : collectionRate >= 70 ? "warning" : "danger"}
        />
        <StatTile
          label="Occupancy"
          value={totalUnits > 0 ? `${formatNumber((occupied / totalUnits) * 100, 0)}%` : "—"}
          hint={`${occupied} of ${totalUnits} units`}
        />
        <StatTile
          label="Billed this month"
          value={formatMoney(billed)}
          hint={`${invoices.data?.length ?? 0} invoices`}
          href={`/estate/billing?org=${orgId}`}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Active DebiChecks" value={activeMandates} href={`/estate/collections?org=${orgId}`} />
        <StatTile label="Active payment plans" value={activePlans} href={`/estate/tenants?org=${orgId}`} />
        <StatTile
          label="Prepaid electricity"
          value={formatMoney(electricitySpend)}
          hint={`${formatNumber(electricityUnits, 0)} kWh sold`}
        />
        <StatTile
          label="Gate activity"
          value={gateGranted + gateDenied}
          hint={`${gateDenied} denied`}
          tone={gateDenied > 0 ? "warning" : "neutral"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Debtor ageing" className="lg:col-span-1">
          <MiniBar
            segments={[
              { label: "Current", value: ageing.current, className: "bg-brand-500" },
              { label: "30 days", value: ageing.d30, className: "bg-slate-300" },
              { label: "60 days", value: ageing.d60, className: "bg-red-300" },
              { label: "90 days", value: ageing.d90, className: "bg-red-600" },
              { label: "120+ days", value: ageing.d120, className: "bg-red-900" },
            ]}
          />
          <dl className="mt-4 space-y-2 text-sm">
            <AgeRow label="Current" value={ageing.current} dot="bg-brand-500" />
            <AgeRow label="30 days" value={ageing.d30} dot="bg-slate-300" />
            <AgeRow label="60 days" value={ageing.d60} dot="bg-red-300" />
            <AgeRow label="90 days" value={ageing.d90} dot="bg-red-600" />
            <AgeRow label="120+ days" value={ageing.d120} dot="bg-red-900" />
          </dl>
        </Card>

        <Card
          title="High consumption flags"
          className="lg:col-span-2"
          action={
            <Link href={`/estate/usage?org=${orgId}`} className="text-brand-700 text-xs font-medium">
              View all
            </Link>
          }
        >
          {alerts.data && alerts.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Unit</Th>
                  <Th>Utility</Th>
                  <Th>Detail</Th>
                  <Th align="right">Above normal</Th>
                  <Th>Severity</Th>
                </tr>
              </thead>
              <tbody>
                {alerts.data.map((alert) => (
                  <tr key={alert.id}>
                    <Td>{(alert.units as { unit_number: string } | null)?.unit_number ?? "—"}</Td>
                    <Td>{humanise(alert.utility)}</Td>
                    <Td className="max-w-md truncate">{alert.detail}</Td>
                    <Td align="right">{formatNumber(alert.deviation_percent, 0)}%</Td>
                    <Td>
                      <StatusBadge status={alert.severity} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No consumption anomalies"
              description="Units are tracking within their usual range."
            />
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card
          title="Pending approvals"
          action={
            <Link href={`/estate/approvals?org=${orgId}`} className="text-brand-700 text-xs font-medium">
              Review
            </Link>
          }
        >
          {approvals.data && approvals.data.length > 0 ? (
            <ul className="space-y-3">
              {approvals.data.map((approval) => (
                <li key={approval.id} className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-800">
                      {approval.title}
                    </p>
                    <p className="text-xs text-slate-500">
                      {humanise(approval.type)}
                    </p>
                  </div>
                  {approval.amount && (
                    <span className="tabular text-sm font-medium">
                      {formatMoney(approval.amount)}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing awaiting approval" />
          )}
        </Card>

        <Card
          title="Open maintenance"
          action={
            <Link href={`/estate/maintenance?org=${orgId}`} className="text-brand-700 text-xs font-medium">
              View all
            </Link>
          }
        >
          {maintenance.data && maintenance.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Ref</Th>
                  <Th>Unit</Th>
                  <Th>Issue</Th>
                  <Th>Priority</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {maintenance.data.map((request) => (
                  <tr key={request.id}>
                    <Td>{request.reference}</Td>
                    <Td>{(request.units as { unit_number: string } | null)?.unit_number ?? "—"}</Td>
                    <Td className="max-w-[12rem] truncate">{request.title}</Td>
                    <Td>
                      <Badge
                        tone={
                          request.priority === "emergency"
                            ? "danger"
                            : request.priority === "high"
                              ? "warning"
                              : "neutral"
                        }
                      >
                        {humanise(request.priority)}
                      </Badge>
                    </Td>
                    <Td>
                      <StatusBadge status={request.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="No open requests" />
          )}
        </Card>
      </div>

      <Card className="mt-5" title="Communications this month">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              Messages sent
            </p>
            <p className="tabular mt-1 text-2xl font-semibold">{deliveries.data?.length ?? 0}</p>
          </div>
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              Delivered
            </p>
            <p className="tabular mt-1 text-2xl font-semibold text-brand-600">
              {delivered}
            </p>
          </div>
          <div>
            <p className="text-xs tracking-wide text-slate-500 uppercase">
              Failed
            </p>
            <p className="tabular mt-1 text-2xl font-semibold text-red-600">
              {deliveryFailed}
            </p>
          </div>
        </div>
      </Card>
    </>
  );
}

function AgeRow({ label, value, dot }: { label: string; value: number; dot: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="flex items-center gap-2 text-slate-600">
        <span className={`h-2 w-2 rounded-full ${dot}`} />
        {label}
      </dt>
      <dd className="tabular font-medium text-slate-800">
        {formatMoney(value)}
      </dd>
    </div>
  );
}
