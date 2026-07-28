import Link from "next/link";

import { resolveUnit } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { PayForm } from "@/components/tenant/pay-form";
import { AcceptPlanButton } from "@/components/tenant/accept-plan";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Billing" };

const CHANNELS = [
  "rent",
  "levy",
  "water",
  "electricity",
  "maintenance",
  "refuse",
  "security",
  "other",
] as const;

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string; channel?: string }>;
}) {
  const params = await searchParams;
  const { unit } = await resolveUnit(searchParams);
  const supabase = await createClient();

  const channel = CHANNELS.find((c) => c === params.channel);

  let ledgerQuery = supabase
    .from("ledger_entries")
    .select("id, direction, channel, amount, description, occurred_at, balance_after, reference")
    .eq("account_id", unit.accountId ?? "")
    .order("occurred_at", { ascending: false })
    .limit(60);

  if (channel) ledgerQuery = ledgerQuery.eq("channel", channel);

  const [account, invoices, ledger, plan, mandate] = await Promise.all([
    supabase
      .from("tenant_accounts")
      .select(
        "id, account_number, balance, current_due, overdue_30, overdue_60, overdue_90, overdue_120_plus, last_payment_at, last_payment_amount",
      )
      .eq("id", unit.accountId ?? "")
      .maybeSingle(),
    supabase
      .from("invoices")
      .select("id, invoice_number, period_start, issue_date, due_date, total, amount_paid, amount_due, status")
      .eq("account_id", unit.accountId ?? "")
      .order("due_date", { ascending: false })
      .limit(24),
    ledgerQuery,
    supabase
      .from("payment_plans")
      .select(
        "id, reference, status, arrears_amount, instalment_amount, instalment_count, first_due_date, amount_paid, payment_plan_instalments(sequence, due_date, amount, status)",
      )
      .eq("account_id", unit.accountId ?? "")
      .in("status", ["proposed", "awaiting_acceptance", "active"])
      .maybeSingle(),
    supabase
      .from("debicheck_mandates")
      .select("id, contract_reference, status, instalment_amount, collection_day, bank_name, account_number_masked")
      .eq("account_id", unit.accountId ?? "")
      .in("status", ["active", "authenticated", "pending_authentication"])
      .maybeSingle(),
  ]);

  const balance = Number(account.data?.balance ?? 0);

  return (
    <>
      <PageHeader
        title="Billing"
        description={`Unit ${unit.unitNumber} · Account ${unit.accountNumber ?? "—"}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Balance"
          value={formatMoney(balance)}
          hint={balance > 0 ? "Owing" : balance < 0 ? "In credit" : "Settled"}
          tone={balance > 0 ? "danger" : "success"}
        />
        <StatTile label="Current" value={formatMoney(account.data?.current_due ?? 0)} />
        <StatTile
          label="30–60 days"
          value={formatMoney(Number(account.data?.overdue_30 ?? 0) + Number(account.data?.overdue_60 ?? 0))}
          tone="warning"
        />
        <StatTile
          label="90+ days"
          value={formatMoney(
            Number(account.data?.overdue_90 ?? 0) + Number(account.data?.overdue_120_plus ?? 0),
          )}
          tone="danger"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card title="Make a payment" description="Card payments are 3-D Secure protected.">
            <PayForm accountId={unit.accountId ?? ""} balance={balance} />
          </Card>

          {mandate.data && (
            <Card className="mt-5" title="DebiCheck mandate">
              <dl className="space-y-2 text-sm">
                <Row label="Status"><StatusBadge status={mandate.data.status} /></Row>
                <Row label="Instalment">{formatMoney(mandate.data.instalment_amount)}</Row>
                <Row label="Collection day">Day {mandate.data.collection_day}</Row>
                <Row label="Bank">{mandate.data.bank_name}</Row>
                <Row label="Account">{mandate.data.account_number_masked}</Row>
              </dl>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Authenticated mandates are collected automatically each month.
              </p>
            </Card>
          )}

          {plan.data && (
            <Card className="mt-5" title="Payment arrangement">
              <div className="mb-3 flex items-center justify-between">
                <StatusBadge status={plan.data.status} />
                <span className="text-xs text-slate-500">{plan.data.reference}</span>
              </div>
              <dl className="space-y-2 text-sm">
                <Row label="Arrears">{formatMoney(plan.data.arrears_amount)}</Row>
                <Row label="Instalment">{formatMoney(plan.data.instalment_amount)}</Row>
                <Row label="Instalments">{plan.data.instalment_count}</Row>
                <Row label="Paid so far">{formatMoney(plan.data.amount_paid)}</Row>
              </dl>

              {(plan.data.status === "proposed" || plan.data.status === "awaiting_acceptance") && (
                <div className="mt-4">
                  <AcceptPlanButton planId={plan.data.id} />
                </div>
              )}
            </Card>
          )}
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card title="Invoices">
            {invoices.data && invoices.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Period</Th>
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
                        {new Date(invoice.period_start).toLocaleDateString("en-ZA", {
                          month: "short",
                          year: "numeric",
                        })}
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
              <EmptyState title="No invoices yet" />
            )}
          </Card>

          <Card
            title="Transaction history"
            description="Every charge and payment, split by what it was for."
          >
            <div className="mb-4 flex flex-wrap gap-1.5">
              <ChannelChip unitId={unit.unitId} label="All" active={!channel} />
              {CHANNELS.map((c) => (
                <ChannelChip
                  key={c}
                  unitId={unit.unitId}
                  channel={c}
                  label={humanise(c)}
                  active={channel === c}
                />
              ))}
            </div>

            {ledger.data && ledger.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Description</Th>
                    <Th>Channel</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Balance</Th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.data.map((entry) => (
                    <tr key={entry.id}>
                      <Td>
                        {new Date(entry.occurred_at).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </Td>
                      <Td>{entry.description}</Td>
                      <Td>
                        <Badge tone="neutral">{humanise(entry.channel)}</Badge>
                      </Td>
                      <Td
                        align="right"
                        className={
                          entry.direction === "credit"
                            ? "font-medium text-brand-600 dark:text-brand-400"
                            : "text-slate-700 dark:text-slate-300"
                        }
                      >
                        {entry.direction === "credit" ? "−" : "+"}
                        {formatMoney(entry.amount)}
                      </Td>
                      <Td align="right">{formatMoney(entry.balance_after)}</Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No transactions on this channel"
                description="Try a different channel or clear the filter."
              />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="tabular font-medium text-slate-800 dark:text-slate-200">{children}</dd>
    </div>
  );
}

function ChannelChip({
  unitId,
  channel,
  label,
  active,
}: {
  unitId: string;
  channel?: string;
  label: string;
  active: boolean;
}) {
  const href = channel
    ? `/tenant/billing?unit=${unitId}&channel=${channel}`
    : `/tenant/billing?unit=${unitId}`;

  return (
    <Link
      href={href}
      className={
        active
          ? "bg-brand-700 rounded-full px-2.5 py-1 text-xs font-medium text-white"
          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
      }
    >
      {label}
    </Link>
  );
}
