import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { ExportCsvButton } from "@/components/admin/export-csv-button";
import { Badge, Card, EmptyState, PageHeader, StatTile, TableWrap, Td, Th } from "@/components/ui";

export const metadata = { title: "Reports" };

export default async function AdminReportsPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const [orgsResult, ledgerResult, accountsResult, plansResult, instalmentsResult, legalResult] =
    await Promise.all([
      supabase.from("organisations").select("id, name").order("name"),
      supabase.from("ledger_entries").select("org_id, direction, amount").limit(20000),
      supabase
        .from("tenant_accounts")
        .select("org_id, balance, is_in_arrears, current_due, overdue_30, overdue_60, overdue_90, overdue_120_plus"),
      supabase
        .from("payment_plans")
        .select("org_id, status, instalment_amount, instalment_count, amount_paid"),
      supabase
        .from("payment_plan_instalments")
        .select("status, payment_plans!inner(org_id)")
        .limit(20000),
      supabase.from("legal_cases").select("org_id, stage, amount"),
    ]);

  const orgs = orgsResult.data ?? [];
  const ledger = ledgerResult.data ?? [];
  const accounts = accountsResult.data ?? [];
  const plans = plansResult.data ?? [];
  const instalments = instalmentsResult.data ?? [];
  const legalCases = legalResult.data ?? [];

  const revenueRows = orgs.map((org) => {
    const rows = ledger.filter((l) => l.org_id === org.id);
    const billed = rows.filter((r) => r.direction === "debit").reduce((s, r) => s + Number(r.amount), 0);
    const collected = rows.filter((r) => r.direction === "credit").reduce((s, r) => s + Number(r.amount), 0);
    const rate = billed > 0 ? (collected / billed) * 100 : 0;
    return { org, billed, collected, rate };
  });

  const arrearsRows = orgs.map((org) => {
    const rows = accounts.filter((a) => a.org_id === org.id);
    const outstanding = rows.reduce((s, a) => s + Math.max(Number(a.balance), 0), 0);
    const severe = rows.reduce((s, a) => s + Number(a.overdue_90) + Number(a.overdue_120_plus), 0);
    const inArrears = rows.filter((a) => a.is_in_arrears).length;
    return { org, accounts: rows.length, inArrears, outstanding, severe };
  });

  const planRows = orgs.map((org) => {
    const orgPlans = plans.filter((p) => p.org_id === org.id);
    const active = orgPlans.filter((p) => p.status === "active");
    const defaulted = orgPlans.filter((p) => p.status === "defaulted");
    const value = active.reduce(
      (s, p) => s + Math.max(Number(p.instalment_amount) * p.instalment_count - Number(p.amount_paid), 0),
      0,
    );
    const orgInstalments = instalments.filter(
      (i) => (i.payment_plans as { org_id: string } | null)?.org_id === org.id,
    );
    const paid = orgInstalments.filter((i) => i.status === "paid").length;
    const missed = orgInstalments.filter((i) => i.status === "missed").length;
    const adherence = paid + missed > 0 ? (paid / (paid + missed)) * 100 : null;
    return { org, active: active.length, defaulted: defaulted.length, value, adherence };
  });

  const legalRows = orgs.map((org) => {
    const rows = legalCases.filter((c) => c.org_id === org.id);
    const open = rows.filter((c) => c.stage !== "resolved");
    const value = open.reduce((s, c) => s + Number(c.amount), 0);
    return { org, open: open.length, resolved: rows.length - open.length, value };
  });

  const totalBilled = revenueRows.reduce((s, r) => s + r.billed, 0);
  const totalCollected = revenueRows.reduce((s, r) => s + r.collected, 0);
  const totalOutstanding = arrearsRows.reduce((s, r) => s + r.outstanding, 0);
  const totalOpenLegal = legalRows.reduce((s, r) => s + r.open, 0);

  return (
    <>
      <PageHeader title="Reports" description="Revenue, arrears, payment plan and legal escalation summaries, per organisation." />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Billed" value={formatMoney(totalBilled)} />
        <StatTile label="Collected" value={formatMoney(totalCollected)} tone="success" />
        <StatTile label="Outstanding" value={formatMoney(totalOutstanding)} tone="danger" />
        <StatTile label="Open legal matters" value={totalOpenLegal} tone={totalOpenLegal ? "warning" : "success"} />
      </div>

      <Card
        className="mb-5"
        title="Revenue vs collections"
        action={
          <ExportCsvButton
            filename="revenue-vs-collections.csv"
            headers={["Organisation", "Billed", "Collected", "Collection rate %"]}
            rows={revenueRows.map((r) => [r.org.name, r.billed.toFixed(2), r.collected.toFixed(2), r.rate.toFixed(1)])}
          />
        }
      >
        {revenueRows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Organisation</Th>
                <Th align="right">Billed</Th>
                <Th align="right">Collected</Th>
                <Th align="right">Rate</Th>
              </tr>
            </thead>
            <tbody>
              {revenueRows.map((r) => (
                <tr key={r.org.id}>
                  <Td>{r.org.name}</Td>
                  <Td align="right">{formatMoney(r.billed)}</Td>
                  <Td align="right">{formatMoney(r.collected)}</Td>
                  <Td align="right">
                    <Badge tone={r.rate >= 90 ? "success" : r.rate >= 70 ? "warning" : "danger"}>
                      {r.rate.toFixed(0)}%
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No organisations yet" />
        )}
      </Card>

      <Card
        className="mb-5"
        title="Arrears aging"
        action={
          <ExportCsvButton
            filename="arrears-aging.csv"
            headers={["Organisation", "Accounts", "In arrears", "Outstanding", "61+ days"]}
            rows={arrearsRows.map((r) => [r.org.name, r.accounts, r.inArrears, r.outstanding.toFixed(2), r.severe.toFixed(2)])}
          />
        }
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>Organisation</Th>
              <Th align="right">In arrears</Th>
              <Th align="right">Outstanding</Th>
              <Th align="right">61+ days</Th>
            </tr>
          </thead>
          <tbody>
            {arrearsRows.map((r) => (
              <tr key={r.org.id}>
                <Td>{r.org.name}</Td>
                <Td align="right">
                  {r.inArrears} / {r.accounts}
                </Td>
                <Td align="right" className="font-medium text-red-600">
                  {formatMoney(r.outstanding)}
                </Td>
                <Td align="right">{formatMoney(r.severe)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Card
        className="mb-5"
        title="Payment plan adherence"
        action={
          <ExportCsvButton
            filename="payment-plan-adherence.csv"
            headers={["Organisation", "Active", "Defaulted", "Value under plan", "Adherence %"]}
            rows={planRows.map((r) => [
              r.org.name,
              r.active,
              r.defaulted,
              r.value.toFixed(2),
              r.adherence === null ? "" : r.adherence.toFixed(1),
            ])}
          />
        }
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>Organisation</Th>
              <Th align="right">Active</Th>
              <Th align="right">Defaulted</Th>
              <Th align="right">Value under plan</Th>
              <Th align="right">Adherence</Th>
            </tr>
          </thead>
          <tbody>
            {planRows.map((r) => (
              <tr key={r.org.id}>
                <Td>{r.org.name}</Td>
                <Td align="right">{r.active}</Td>
                <Td align="right" className={r.defaulted ? "text-red-600" : undefined}>
                  {r.defaulted}
                </Td>
                <Td align="right">{formatMoney(r.value)}</Td>
                <Td align="right">{r.adherence === null ? "—" : `${r.adherence.toFixed(0)}%`}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>

      <Card
        title="Legal escalations"
        action={
          <ExportCsvButton
            filename="legal-escalations.csv"
            headers={["Organisation", "Open", "Resolved", "Value at stake"]}
            rows={legalRows.map((r) => [r.org.name, r.open, r.resolved, r.value.toFixed(2)])}
          />
        }
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>Organisation</Th>
              <Th align="right">Open</Th>
              <Th align="right">Resolved</Th>
              <Th align="right">Value at stake</Th>
            </tr>
          </thead>
          <tbody>
            {legalRows.map((r) => (
              <tr key={r.org.id}>
                <Td>{r.org.name}</Td>
                <Td align="right">{r.open}</Td>
                <Td align="right">{r.resolved}</Td>
                <Td align="right">{formatMoney(r.value)}</Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      </Card>
    </>
  );
}
