import { notFound } from "next/navigation";
import Link from "next/link";

import { requireTenant } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/domain/money";
import {
  Card,
  PageHeader,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Invoice" };

export default async function InvoiceDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await requireTenant();

  const supabase = await createClient();

  // RLS restricts this to invoices on the caller's own account.
  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `id, invoice_number, status, period_start, period_end, issue_date, due_date,
       subtotal, vat_total, total, amount_paid, amount_due, notes,
       units(unit_number, properties(name)),
       invoice_lines(id, channel, description, quantity, unit_price, net_amount, vat_amount, total_amount, reading_from, reading_to, sequence),
       organisations(name, vat_number, address_line1, city, postal_code)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!invoice) notFound();

  const unit = invoice.units as { unit_number: string; properties: { name: string } | null } | null;
  const org = invoice.organisations as {
    name: string;
    vat_number: string | null;
    address_line1: string | null;
    city: string | null;
    postal_code: string | null;
  } | null;

  const lines = [...(invoice.invoice_lines ?? [])].sort((a, b) => a.sequence - b.sequence);

  return (
    <>
      <PageHeader
        title={invoice.invoice_number}
        description={`${unit?.properties?.name ?? ""} · Unit ${unit?.unit_number ?? ""}`}
        action={
          <Link
            href="/tenant/billing"
            className="text-brand-700 text-sm font-medium"
          >
            Back to billing
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card title="Charges">
            <TableWrap>
              <thead>
                <tr>
                  <Th>Description</Th>
                  <Th>Channel</Th>
                  <Th align="right">Qty</Th>
                  <Th align="right">Rate</Th>
                  <Th align="right">VAT</Th>
                  <Th align="right">Total</Th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => (
                  <tr key={line.id}>
                    <Td>
                      {line.description}
                      {line.reading_from !== null && line.reading_to !== null && (
                        <span className="block text-xs text-slate-500">
                          Reading {formatNumber(line.reading_from, 1)} →{" "}
                          {formatNumber(line.reading_to, 1)}
                        </span>
                      )}
                    </Td>
                    <Td>{humanise(line.channel)}</Td>
                    <Td align="right">{formatNumber(line.quantity, 2)}</Td>
                    <Td align="right">{formatMoney(line.unit_price)}</Td>
                    <Td align="right">{formatMoney(line.vat_amount)}</Td>
                    <Td align="right">{formatMoney(line.total_amount)}</Td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <Td colSpan={4} />
                  <Td align="right" className="font-medium">
                    Subtotal
                  </Td>
                  <Td align="right">{formatMoney(invoice.subtotal)}</Td>
                </tr>
                <tr>
                  <Td colSpan={4} />
                  <Td align="right" className="font-medium">
                    VAT
                  </Td>
                  <Td align="right">{formatMoney(invoice.vat_total)}</Td>
                </tr>
                <tr>
                  <Td colSpan={4} />
                  <Td align="right" className="font-semibold">
                    Total
                  </Td>
                  <Td align="right" className="font-semibold">
                    {formatMoney(invoice.total)}
                  </Td>
                </tr>
              </tfoot>
            </TableWrap>
          </Card>
        </div>

        <div className="space-y-5">
          <Card title="Summary">
            <dl className="space-y-2.5 text-sm">
              <Row label="Status">
                <StatusBadge status={invoice.status} />
              </Row>
              <Row label="Issued">
                {new Date(invoice.issue_date).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Row>
              <Row label="Due">
                {new Date(invoice.due_date).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </Row>
              <Row label="Period">
                {new Date(invoice.period_start).toLocaleDateString("en-ZA", {
                  month: "short",
                  year: "numeric",
                })}
              </Row>
              <Row label="Paid">{formatMoney(invoice.amount_paid)}</Row>
              <Row label="Outstanding">
                <strong>{formatMoney(invoice.amount_due)}</strong>
              </Row>
            </dl>
          </Card>

          {org && (
            <Card title="Billed by">
              <address className="text-sm text-slate-600 not-italic">
                <strong className="block text-slate-800">{org.name}</strong>
                {org.address_line1 && <span className="block">{org.address_line1}</span>}
                {org.city && (
                  <span className="block">
                    {org.city} {org.postal_code}
                  </span>
                )}
                {org.vat_number && <span className="mt-1 block">VAT {org.vat_number}</span>}
              </address>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500">{label}</dt>
      <dd className="tabular text-slate-800">{children}</dd>
    </div>
  );
}
