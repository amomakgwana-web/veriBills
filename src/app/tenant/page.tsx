import Link from "next/link";

import { resolveUnit } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/domain/money";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatTile,
  StatusBadge,
  Td,
  TableWrap,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Overview" };

export default async function TenantOverview({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { session, unit } = await resolveUnit(searchParams);
  const supabase = await createClient();

  const [invoices, announcements, maintenance, alerts, purchases, plans] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, total, amount_due, due_date, status, period_start")
      .eq("account_id", unit.accountId ?? "")
      .order("due_date", { ascending: false })
      .limit(4),
    supabase
      .from("announcements")
      .select("id, title, body, category, severity, publish_at, is_pinned")
      .lte("publish_at", new Date().toISOString())
      .order("is_pinned", { ascending: false })
      .order("publish_at", { ascending: false })
      .limit(3),
    supabase
      .from("maintenance_requests")
      .select("id, reference, title, status, priority, created_at")
      .eq("unit_id", unit.unitId)
      .not("status", "in", "(closed,resolved)")
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("usage_alerts")
      .select("id, title, detail, severity, utility, created_at")
      .eq("unit_id", unit.unitId)
      .is("resolved_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("electricity_purchases")
      .select("id, units_kwh, gross_amount, created_at, status")
      .eq("unit_id", unit.unitId)
      .order("created_at", { ascending: false })
      .limit(1),
    supabase
      .from("payment_plans")
      .select("id, reference, status, instalment_amount, instalment_count, arrears_amount")
      .eq("account_id", unit.accountId ?? "")
      .in("status", ["proposed", "awaiting_acceptance", "active"])
      .limit(1),
  ]);

  const balance = Number(unit.balance ?? 0);
  const inArrears = balance > 0;
  const nextInvoice = (invoices.data ?? []).find((i) => Number(i.amount_due) > 0);
  const plan = plans.data?.[0];

  return (
    <>
      <PageHeader
        title={`Hello, ${session.fullName?.split(" ")[0] ?? "there"}`}
        description={`${unit.propertyName} · Unit ${unit.unitNumber} · Account ${unit.accountNumber ?? "—"}`}
        action={
          inArrears ? (
            <LinkButton href={`/tenant/billing?unit=${unit.unitId}`}>Pay now</LinkButton>
          ) : (
            <LinkButton href={`/tenant/electricity?unit=${unit.unitId}`} variant="secondary">
              Buy electricity
            </LinkButton>
          )
        }
      />

      {plan && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-red-900 dark:text-red-200">
                {plan.status === "active"
                  ? "You are on a payment arrangement"
                  : "A payment arrangement has been proposed for you"}
              </p>
              <p className="mt-0.5 text-sm text-red-800 dark:text-red-300">
                {formatMoney(plan.instalment_amount)} × {plan.instalment_count} towards{" "}
                {formatMoney(plan.arrears_amount)} of arrears.
              </p>
            </div>
            <LinkButton href={`/tenant/billing?unit=${unit.unitId}`} variant="secondary" size="sm">
              View plan
            </LinkButton>
          </div>
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Account balance"
          value={formatMoney(balance)}
          hint={inArrears ? "Payment due" : "Up to date"}
          tone={inArrears ? "danger" : "success"}
        />
        <StatTile
          label="Next due"
          value={nextInvoice ? formatMoney(nextInvoice.amount_due) : "—"}
          hint={
            nextInvoice
              ? new Date(nextInvoice.due_date).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                })
              : "Nothing outstanding"
          }
        />
        <StatTile
          label="Last electricity"
          value={
            purchases.data?.[0]
              ? `${formatNumber(purchases.data[0].units_kwh, 1)} kWh`
              : "—"
          }
          hint={
            purchases.data?.[0]
              ? formatMoney(purchases.data[0].gross_amount)
              : "No purchases yet"
          }
          href={`/tenant/electricity?unit=${unit.unitId}`}
        />
        <StatTile
          label="Open requests"
          value={maintenance.data?.length ?? 0}
          hint="Maintenance"
          href={`/tenant/maintenance?unit=${unit.unitId}`}
        />
      </div>

      {(alerts.data?.length ?? 0) > 0 && (
        <Card className="mb-6" title="Usage alerts">
          <ul className="space-y-3">
            {alerts.data!.map((alert) => (
              <li key={alert.id} className="flex items-start gap-3">
                <Badge tone={alert.severity === "critical" ? "danger" : "warning"}>
                  {humanise(alert.utility)}
                </Badge>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                    {alert.title}
                  </p>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{alert.detail}</p>
                </div>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            A sudden jump often means a leaking toilet or dripping geyser.{" "}
            <Link
              href={`/tenant/maintenance/new?unit=${unit.unitId}`}
              className="text-brand-700 dark:text-brand-400 font-medium"
            >
              Log a maintenance request
            </Link>
            .
          </p>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Recent invoices"
          action={
            <Link
              href={`/tenant/billing?unit=${unit.unitId}`}
              className="text-brand-700 dark:text-brand-400 text-xs font-medium"
            >
              View all
            </Link>
          }
        >
          {invoices.data && invoices.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Invoice</Th>
                  <Th>Due</Th>
                  <Th align="right">Total</Th>
                  <Th align="right">Outstanding</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {invoices.data.map((invoice) => (
                  <tr key={invoice.id}>
                    <Td>
                      <Link
                        href={`/tenant/billing/${invoice.id}`}
                        className="text-brand-700 dark:text-brand-400 font-medium"
                      >
                        {invoice.invoice_number}
                      </Link>
                    </Td>
                    <Td>
                      {new Date(invoice.due_date).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                      })}
                    </Td>
                    <Td align="right">{formatMoney(invoice.total)}</Td>
                    <Td align="right">{formatMoney(invoice.amount_due)}</Td>
                    <Td>
                      <StatusBadge status={invoice.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="No invoices yet" description="Your first bill will appear here." />
          )}
        </Card>

        <Card
          title="Announcements"
          action={
            <Link
              href="/tenant/announcements"
              className="text-brand-700 dark:text-brand-400 text-xs font-medium"
            >
              View all
            </Link>
          }
        >
          {announcements.data && announcements.data.length > 0 ? (
            <ul className="space-y-4">
              {announcements.data.map((item) => (
                <li key={item.id}>
                  <div className="flex items-center gap-2">
                    {item.is_pinned && <Badge tone="brand">Pinned</Badge>}
                    <Badge tone={item.severity === "critical" ? "danger" : "neutral"}>
                      {humanise(item.category)}
                    </Badge>
                    <span className="text-xs text-slate-400">
                      {new Date(item.publish_at).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium text-slate-800 dark:text-slate-200">
                    {item.title}
                  </p>
                  <p className="line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {item.body}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nothing to report" description="Estate notices will show up here." />
          )}
        </Card>
      </div>
    </>
  );
}
