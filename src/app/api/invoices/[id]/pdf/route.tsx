import { renderToBuffer } from "@react-pdf/renderer";

import { createClient } from "@/lib/supabase/server";
import { InvoiceDocument, type InvoicePdfData } from "@/lib/pdf/invoice-document";

/** Streams a branded PDF for one invoice. RLS scopes this the same way the on-screen detail page is scoped — the caller's own account, or their org if they're estate staff. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: invoice } = await supabase
    .from("invoices")
    .select(
      `invoice_number, status, period_start, issue_date, due_date,
       subtotal, vat_total, total, amount_paid, amount_due,
       units(unit_number, properties(name)),
       invoice_lines(id, channel, description, quantity, unit_price, net_amount, vat_amount, total_amount, reading_from, reading_to, sequence),
       organisations(name, vat_number, address_line1, city, postal_code)`,
    )
    .eq("id", id)
    .maybeSingle();

  if (!invoice) {
    return new Response("Invoice not found", { status: 404 });
  }

  const unit = invoice.units as { unit_number: string; properties: { name: string } | null } | null;
  const org = invoice.organisations as InvoicePdfData["org"];
  const lines = [...(invoice.invoice_lines ?? [])].sort((a, b) => a.sequence - b.sequence);

  const data: InvoicePdfData = {
    invoice_number: invoice.invoice_number,
    status: invoice.status,
    period_start: invoice.period_start,
    issue_date: invoice.issue_date,
    due_date: invoice.due_date,
    subtotal: invoice.subtotal,
    vat_total: invoice.vat_total,
    total: invoice.total,
    amount_paid: invoice.amount_paid,
    amount_due: invoice.amount_due,
    unit: unit ? { unit_number: unit.unit_number, property_name: unit.properties?.name ?? null } : null,
    org,
    lines,
  };

  const buffer = await renderToBuffer(<InvoiceDocument invoice={data} />);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${invoice.invoice_number}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
