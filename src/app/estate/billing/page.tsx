import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { BillingRunForm } from "@/components/estate/billing-run-form";
import { ApprovalCard } from "@/components/estate/approval-card";
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

export const metadata = { title: "Billing" };

export default async function EstateBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { session, membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [runs, properties, invoices, planRequests] = await Promise.all([
    supabase
      .from("billing_runs")
      .select("id, period_start, period_end, due_date, status, invoices_created, total_billed, completed_at, error_message")
      .eq("org_id", orgId)
      .order("period_start", { ascending: false })
      .limit(12),
    supabase.from("properties").select("id, name").eq("org_id", orgId).eq("is_active", true),
    supabase
      .from("invoices")
      .select("id, invoice_number, status, total, amount_due, due_date, units(unit_number)")
      .eq("org_id", orgId)
      .in("status", ["issued", "part_paid", "overdue"])
      .order("due_date", { ascending: true })
      .limit(40),
    supabase
      .from("approvals")
      .select(
        "id, type, title, description, amount, required_approvals, approvals_received, created_at, approval_decisions(decided_by)",
      )
      .eq("org_id", orgId)
      .eq("type", "payment_plan")
      .eq("status", "pending")
      .order("created_at", { ascending: false }),
  ]);

  const outstanding = (invoices.data ?? []).reduce((sum, i) => sum + Number(i.amount_due), 0);
  const overdue = (invoices.data ?? []).filter((i) => i.status === "overdue");

  return (
    <>
      <PageHeader title="Billing" description="Run the monthly cycle and track what is owed." />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Open invoices" value={invoices.data?.length ?? 0} />
        <StatTile label="Outstanding" value={formatMoney(outstanding)} tone="danger" />
        <StatTile label="Overdue" value={overdue.length} tone={overdue.length ? "danger" : "success"} />
      </div>

      {planRequests.data && planRequests.data.length > 0 && (
        <div className="mb-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-900">
            Payment plan requests ({planRequests.data.length})
          </h2>
          {planRequests.data.map((approval) => {
            const decisions = (approval.approval_decisions ?? []) as { decided_by: string }[];
            const alreadyDecided = decisions.some((d) => d.decided_by === session.userId);
            return (
              <ApprovalCard
                key={approval.id}
                approval={{
                  id: approval.id,
                  type: approval.type,
                  title: approval.title,
                  description: approval.description,
                  amount: approval.amount,
                  requiredApprovals: approval.required_approvals,
                  approvalsReceived: approval.approvals_received,
                  createdAt: approval.created_at,
                }}
                alreadyDecided={alreadyDecided}
              />
            );
          })}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card
          title="Run a billing cycle"
          description="Generates invoices from leases, recurring charges and metered consumption."
        >
          <BillingRunForm orgId={orgId} properties={properties.data ?? []} />
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card title="Recent runs">
            {runs.data && runs.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Period</Th>
                    <Th>Due</Th>
                    <Th align="right">Invoices</Th>
                    <Th align="right">Billed</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.map((run) => (
                    <tr key={run.id}>
                      <Td>
                        {new Date(run.period_start).toLocaleDateString("en-ZA", {
                          month: "long",
                          year: "numeric",
                        })}
                      </Td>
                      <Td>
                        {new Date(run.due_date).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                        })}
                      </Td>
                      <Td align="right">{run.invoices_created}</Td>
                      <Td align="right">{formatMoney(run.total_billed)}</Td>
                      <Td>
                        <StatusBadge status={run.status} />
                        {run.error_message && (
                          <span className="block text-xs text-red-500">{run.error_message}</span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No billing runs yet"
                description="Run your first cycle to generate invoices."
              />
            )}
          </Card>

          <Card title="Open invoices">
            {invoices.data && invoices.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Invoice</Th>
                    <Th>Unit</Th>
                    <Th>Due</Th>
                    <Th align="right">Total</Th>
                    <Th align="right">Outstanding</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {invoices.data.map((invoice) => (
                    <tr key={invoice.id}>
                      <Td>{invoice.invoice_number}</Td>
                      <Td>{(invoice.units as { unit_number: string } | null)?.unit_number ?? "—"}</Td>
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
              <EmptyState title="Nothing outstanding" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
