import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
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

export const metadata = { title: "Transaction statements" };

/**
 * Platform-wide transaction statement.
 *
 * Reads straight off the ledger, which is the authoritative record: every
 * charge and payment lands there tagged by channel, so this reconciles by
 * construction with the tenant-facing history.
 */
export default async function StatementsPage({
  searchParams,
}: {
  searchParams: Promise<{ channel?: string }>;
}) {
  await requireSystemAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("ledger_entries")
    .select(
      "id, direction, channel, amount, description, occurred_at, reference, organisations(name), tenant_accounts(account_number)",
    )
    .order("occurred_at", { ascending: false })
    .limit(150);

  if (params.channel) {
    query = query.eq(
      "channel",
      params.channel as "rent" | "levy" | "water" | "electricity" | "other",
    );
  }

  const [entries, summary] = await Promise.all([
    query,
    supabase.from("ledger_entries").select("direction, channel, amount").limit(10000),
  ]);

  const rows = summary.data ?? [];

  const byChannel = new Map<string, { debit: number; credit: number }>();
  for (const row of rows) {
    const bucket = byChannel.get(row.channel) ?? { debit: 0, credit: 0 };
    if (row.direction === "debit") bucket.debit += Number(row.amount);
    else bucket.credit += Number(row.amount);
    byChannel.set(row.channel, bucket);
  }

  const totalDebit = rows
    .filter((r) => r.direction === "debit")
    .reduce((s, r) => s + Number(r.amount), 0);
  const totalCredit = rows
    .filter((r) => r.direction === "credit")
    .reduce((s, r) => s + Number(r.amount), 0);

  return (
    <>
      <PageHeader
        title="Transaction statements"
        description="Platform-wide ledger, split by billing channel."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Total billed" value={formatMoney(totalDebit)} />
        <StatTile label="Total received" value={formatMoney(totalCredit)} tone="success" />
        <StatTile
          label="Net outstanding"
          value={formatMoney(totalDebit - totalCredit)}
          tone={totalDebit - totalCredit > 0 ? "danger" : "success"}
        />
      </div>

      <Card className="mb-5" title="By channel">
        <TableWrap>
          <thead>
            <tr>
              <Th>Channel</Th>
              <Th align="right">Billed</Th>
              <Th align="right">Received</Th>
              <Th align="right">Outstanding</Th>
              <Th align="right">Collection rate</Th>
            </tr>
          </thead>
          <tbody>
            {[...byChannel.entries()]
              .sort((a, b) => b[1].debit - a[1].debit)
              .map(([channel, totals]) => {
                const rate = totals.debit > 0 ? (totals.credit / totals.debit) * 100 : 0;

                return (
                  <tr key={channel}>
                    <Td>{humanise(channel)}</Td>
                    <Td align="right">{formatMoney(totals.debit)}</Td>
                    <Td align="right">{formatMoney(totals.credit)}</Td>
                    <Td align="right">{formatMoney(totals.debit - totals.credit)}</Td>
                    <Td align="right">
                      <Badge
                        tone={rate >= 90 ? "success" : rate >= 70 ? "warning" : "danger"}
                      >
                        {rate.toFixed(0)}%
                      </Badge>
                    </Td>
                  </tr>
                );
              })}
          </tbody>
        </TableWrap>
      </Card>

      <Card title="Ledger entries">
        {entries.data && entries.data.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Organisation</Th>
                <Th>Account</Th>
                <Th>Description</Th>
                <Th>Channel</Th>
                <Th align="right">Amount</Th>
              </tr>
            </thead>
            <tbody>
              {entries.data.map((entry) => (
                <tr key={entry.id}>
                  <Td>
                    {new Date(entry.occurred_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "2-digit",
                    })}
                  </Td>
                  <Td>{(entry.organisations as { name: string } | null)?.name ?? "—"}</Td>
                  <Td>
                    {(entry.tenant_accounts as { account_number: string } | null)?.account_number ??
                      "—"}
                  </Td>
                  <Td className="max-w-[16rem] truncate">{entry.description}</Td>
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
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No ledger entries" />
        )}
      </Card>
    </>
  );
}
