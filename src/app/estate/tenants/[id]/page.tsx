import { notFound } from "next/navigation";
import Link from "next/link";

import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { ProposePlanForm } from "@/components/estate/propose-plan";
import { MandateForm } from "@/components/estate/mandate-form";
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

export const metadata = { title: "Tenant" };

export default async function TenantDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ org?: string }>;
}) {
  const { id } = await params;
  const { membership } = await resolveOrg(searchParams);
  const supabase = await createClient();

  const { data: account } = await supabase
    .from("tenant_accounts")
    .select(
      `id, org_id, account_number, balance, is_in_arrears, is_on_payment_plan,
       current_due, overdue_30, overdue_60, overdue_90, overdue_120_plus,
       last_payment_at, last_payment_amount,
       leases(id, reference, status, start_date, end_date, monthly_rent, monthly_levy,
              deposit_held, escalation_percent,
              units(unit_number, type, properties(name)),
              lease_tenants(profile_id, is_primary, profiles(full_name, email, phone, id_number)))`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!account) notFound();

  const lease = account.leases as {
    id: string;
    reference: string;
    status: string;
    start_date: string;
    end_date: string | null;
    monthly_rent: number;
    monthly_levy: number;
    deposit_held: number;
    escalation_percent: number;
    units: { unit_number: string; type: string; properties: { name: string } | null } | null;
    lease_tenants: Array<{
      profile_id: string;
      is_primary: boolean;
      profiles: {
        full_name: string | null;
        email: string;
        phone: string | null;
        id_number: string | null;
      } | null;
    }>;
  } | null;

  const primary = lease?.lease_tenants.find((t) => t.is_primary) ?? lease?.lease_tenants[0];

  const [invoices, ledger, score, documents, plans, mandates] = await Promise.all([
    supabase
      .from("invoices")
      .select("id, invoice_number, period_start, due_date, total, amount_paid, amount_due, status")
      .eq("account_id", id)
      .order("due_date", { ascending: false })
      .limit(12),
    supabase
      .from("ledger_entries")
      .select("id, direction, channel, amount, description, occurred_at, balance_after")
      .eq("account_id", id)
      .order("occurred_at", { ascending: false })
      .limit(20),
    primary
      ? supabase
          .from("tenant_scores")
          .select("score, band, on_time_payments, late_payments, missed_payments, failed_collections, average_days_late, months_tenancy")
          .eq("profile_id", primary.profile_id)
          .eq("org_id", account.org_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("documents")
      .select("id, type, title, created_at, version")
      .eq("lease_id", lease?.id ?? "")
      .limit(20),
    supabase
      .from("payment_plans")
      .select("id, reference, status, arrears_amount, instalment_amount, instalment_count, amount_paid")
      .eq("account_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("debicheck_mandates")
      .select("id, contract_reference, status, instalment_amount, collection_day, bank_name, account_number_masked")
      .eq("account_id", id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const balance = Number(account.balance);

  return (
    <>
      <PageHeader
        title={primary?.profiles?.full_name ?? account.account_number}
        description={`${lease?.units?.properties?.name ?? ""} · Unit ${lease?.units?.unit_number ?? ""} · ${account.account_number}`}
        action={
          <Link
            href={`/estate/tenants?org=${membership.orgId}`}
            className="text-brand-700 text-sm font-medium"
          >
            Back to tenants
          </Link>
        }
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Balance"
          value={formatMoney(balance)}
          tone={balance > 0 ? "danger" : "success"}
          hint={balance > 0 ? "In arrears" : "Up to date"}
        />
        <StatTile label="Current" value={formatMoney(account.current_due)} />
        <StatTile
          label="90+ days"
          value={formatMoney(Number(account.overdue_90) + Number(account.overdue_120_plus))}
          tone="danger"
        />
        <StatTile
          label="Last payment"
          value={account.last_payment_amount ? formatMoney(account.last_payment_amount) : "—"}
          hint={
            account.last_payment_at
              ? new Date(account.last_payment_at).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                })
              : "No payments"
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5">
          <Card title="Contact">
            <dl className="space-y-2 text-sm">
              <Row label="Name">{primary?.profiles?.full_name ?? "—"}</Row>
              <Row label="Email">{primary?.profiles?.email ?? "—"}</Row>
              <Row label="Phone">{primary?.profiles?.phone ?? "—"}</Row>
              <Row label="ID number">{primary?.profiles?.id_number ?? "—"}</Row>
            </dl>
          </Card>

          <Card title="Lease">
            <dl className="space-y-2 text-sm">
              <Row label="Reference">{lease?.reference}</Row>
              <Row label="Status">
                <StatusBadge status={lease?.status} />
              </Row>
              <Row label="Rent">{formatMoney(lease?.monthly_rent ?? 0)}</Row>
              <Row label="Levy">{formatMoney(lease?.monthly_levy ?? 0)}</Row>
              <Row label="Deposit held">{formatMoney(lease?.deposit_held ?? 0)}</Row>
              <Row label="Escalation">{lease?.escalation_percent}%</Row>
              <Row label="Ends">
                {lease?.end_date
                  ? new Date(lease.end_date).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Open"}
              </Row>
            </dl>
          </Card>

          {score.data && (
            <Card title="Payment behaviour">
              <div className="mb-3 flex items-center justify-between">
                <p className="tabular text-3xl font-semibold">{score.data.score}</p>
                <Badge
                  tone={
                    score.data.band === "excellent" || score.data.band === "good"
                      ? "success"
                      : score.data.band === "fair"
                        ? "warning"
                        : "danger"
                  }
                >
                  {humanise(score.data.band)}
                </Badge>
              </div>
              <dl className="space-y-1.5 text-sm">
                <Row label="On time">{score.data.on_time_payments}</Row>
                <Row label="Late">{score.data.late_payments}</Row>
                <Row label="Missed">{score.data.missed_payments}</Row>
                <Row label="Failed collections">{score.data.failed_collections}</Row>
                <Row label="Avg days late">{Number(score.data.average_days_late).toFixed(1)}</Row>
                <Row label="Months as tenant">{score.data.months_tenancy}</Row>
              </dl>
            </Card>
          )}

          {balance > 0 && (
            <Card
              title="Suggest a payment plan"
              description="Spreads the arrears and emails the tenant to accept."
            >
              <ProposePlanForm orgId={account.org_id} accountId={account.id} balance={balance} />
            </Card>
          )}

          <Card title="Set up DebiCheck" description="Authenticated debit order mandate.">
            <MandateForm
              orgId={account.org_id}
              accountId={account.id}
              profileId={primary?.profile_id ?? ""}
              suggestedAmount={Number(lease?.monthly_rent ?? 0) + Number(lease?.monthly_levy ?? 0)}
            />
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {plans.data && plans.data.length > 0 && (
            <Card title="Payment plans">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Reference</Th>
                    <Th align="right">Arrears</Th>
                    <Th align="right">Instalment</Th>
                    <Th align="right">Paid</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {plans.data.map((plan) => (
                    <tr key={plan.id}>
                      <Td>{plan.reference}</Td>
                      <Td align="right">{formatMoney(plan.arrears_amount)}</Td>
                      <Td align="right">
                        {formatMoney(plan.instalment_amount)} × {plan.instalment_count}
                      </Td>
                      <Td align="right">{formatMoney(plan.amount_paid)}</Td>
                      <Td>
                        <StatusBadge status={plan.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>
          )}

          {mandates.data && mandates.data.length > 0 && (
            <Card title="DebiCheck mandates">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Contract</Th>
                    <Th>Bank</Th>
                    <Th align="right">Instalment</Th>
                    <Th>Day</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {mandates.data.map((mandate) => (
                    <tr key={mandate.id}>
                      <Td>{mandate.contract_reference}</Td>
                      <Td>
                        {mandate.bank_name}
                        <span className="block text-xs text-slate-500">
                          {mandate.account_number_masked}
                        </span>
                      </Td>
                      <Td align="right">{formatMoney(mandate.instalment_amount)}</Td>
                      <Td>{mandate.collection_day}</Td>
                      <Td>
                        <StatusBadge status={mandate.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>
          )}

          <Card title="Invoices">
            {invoices.data && invoices.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Due</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Paid</Th>
                    <Th align="right">Outstanding</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.map((invoice) => (
                    <tr key={invoice.id}>
                      <Td>{invoice.invoice_number}</Td>
                      <Td>
                        {new Date(invoice.due_date).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                        })}
                      </Td>
                      <Td align="right">{formatMoney(invoice.total)}</Td>
                      <Td align="right">{formatMoney(invoice.amount_paid)}</Td>
                      <Td align="right">{formatMoney(invoice.amount_due)}</Td>
                      <Td>
                        <StatusBadge status={invoice.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No invoices" />
            )}
          </Card>

          <Card title="Ledger">
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
                        <Badge>{humanise(entry.channel)}</Badge>
                      </Td>
                      <Td
                        align="right"
                        className={
                          entry.direction === "credit"
                            ? "font-medium text-brand-600"
                            : ""
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
              <EmptyState title="No ledger activity" />
            )}
          </Card>

          <Card title="Documents">
            {documents.data && documents.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Title</Th>
                    <Th>Type</Th>
                    <Th>Version</Th>
                    <Th>Added</Th>
                  </tr>
                </thead>
                <tbody>
                  {documents.data.map((doc) => (
                    <tr key={doc.id}>
                      <Td>{doc.title}</Td>
                      <Td>{humanise(doc.type)}</Td>
                      <Td>v{doc.version}</Td>
                      <Td>
                        {new Date(doc.created_at).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No documents on file"
                description="Signed leases, ID copies, payslips and statements appear here."
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
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular text-right font-medium text-slate-800">
        {children}
      </dd>
    </div>
  );
}
