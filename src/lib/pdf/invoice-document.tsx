import { readFileSync } from "node:fs";
import path from "node:path";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

import { formatMoney, formatNumber } from "@/lib/domain/money";
import { humanise } from "@/components/ui";

const BRAND = "#1800ad";

const logoPath = path.join(process.cwd(), "public/images/veribills-icon.png");
const logo = readFileSync(logoPath);

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9, fontFamily: "Helvetica", color: "#0f172a" },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { width: 28, height: 28, borderRadius: 6 },
  brandName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: BRAND },
  invoiceTitle: { fontSize: 16, fontFamily: "Helvetica-Bold", textAlign: "right" },
  invoiceNumber: { fontSize: 10, color: "#64748b", textAlign: "right", marginTop: 2 },
  section: { marginTop: 24, flexDirection: "row", justifyContent: "space-between" },
  label: { fontSize: 8, color: "#64748b", textTransform: "uppercase", marginBottom: 3 },
  value: { fontSize: 9.5, color: "#0f172a" },
  strong: { fontFamily: "Helvetica-Bold" },
  table: { marginTop: 24, borderTop: "1 solid #e2e8f0" },
  tableHeadRow: {
    flexDirection: "row",
    borderBottom: "1 solid #cbd5e1",
    paddingVertical: 6,
    backgroundColor: "#f8fafc",
  },
  tableRow: { flexDirection: "row", borderBottom: "1 solid #e2e8f0", paddingVertical: 6 },
  colDescription: { width: "38%", paddingRight: 6 },
  colChannel: { width: "14%" },
  colQty: { width: "12%", textAlign: "right" },
  colRate: { width: "12%", textAlign: "right" },
  colVat: { width: "12%", textAlign: "right" },
  colTotal: { width: "12%", textAlign: "right" },
  headCell: { fontSize: 7.5, color: "#64748b", textTransform: "uppercase" },
  reading: { fontSize: 7.5, color: "#94a3b8", marginTop: 1 },
  totals: { marginTop: 16, alignItems: "flex-end" },
  totalsRow: { flexDirection: "row", width: 200, justifyContent: "space-between", marginTop: 3 },
  totalsLabel: { color: "#64748b" },
  grandTotalRow: {
    flexDirection: "row",
    width: 200,
    justifyContent: "space-between",
    marginTop: 6,
    paddingTop: 6,
    borderTop: "1 solid #cbd5e1",
  },
  grandTotalLabel: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  grandTotalValue: { fontFamily: "Helvetica-Bold", fontSize: 10.5 },
  footer: {
    position: "absolute",
    bottom: 30,
    left: 40,
    right: 40,
    borderTop: "1 solid #e2e8f0",
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  footerText: { fontSize: 7.5, color: "#94a3b8" },
});

type InvoiceLine = {
  id: string;
  channel: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
  vat_amount: number | string;
  total_amount: number | string;
  reading_from: number | string | null;
  reading_to: number | string | null;
};

export type InvoicePdfData = {
  invoice_number: string;
  status: string;
  period_start: string;
  issue_date: string;
  due_date: string;
  subtotal: number | string | null;
  vat_total: number | string | null;
  total: number | string | null;
  amount_paid: number | string | null;
  amount_due: number | string | null;
  unit: { unit_number: string; property_name: string | null } | null;
  org: {
    name: string;
    vat_number: string | null;
    address_line1: string | null;
    city: string | null;
    postal_code: string | null;
  } | null;
  lines: InvoiceLine[];
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function InvoiceDocument({ invoice }: { invoice: InvoicePdfData }) {
  return (
    <Document title={invoice.invoice_number}>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View style={styles.brandRow}>
            <Image src={logo} style={styles.logo} />
            <Text style={styles.brandName}>veriBills</Text>
          </View>
          <View>
            <Text style={styles.invoiceTitle}>Tax Invoice</Text>
            <Text style={styles.invoiceNumber}>{invoice.invoice_number}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View>
            <Text style={styles.label}>Billed by</Text>
            {invoice.org && (
              <>
                <Text style={[styles.value, styles.strong]}>{invoice.org.name}</Text>
                {invoice.org.address_line1 && <Text style={styles.value}>{invoice.org.address_line1}</Text>}
                {invoice.org.city && (
                  <Text style={styles.value}>
                    {invoice.org.city} {invoice.org.postal_code}
                  </Text>
                )}
                {invoice.org.vat_number && (
                  <Text style={styles.value}>VAT {invoice.org.vat_number}</Text>
                )}
              </>
            )}
          </View>
          <View>
            <Text style={styles.label}>Property</Text>
            <Text style={[styles.value, styles.strong]}>{invoice.unit?.property_name ?? "—"}</Text>
            <Text style={styles.value}>Unit {invoice.unit?.unit_number ?? "—"}</Text>
          </View>
          <View>
            <Text style={styles.label}>Invoice details</Text>
            <Text style={styles.value}>Period {formatDate(invoice.period_start)}</Text>
            <Text style={styles.value}>Issued {formatDate(invoice.issue_date)}</Text>
            <Text style={styles.value}>Due {formatDate(invoice.due_date)}</Text>
            <Text style={styles.value}>Status {humanise(invoice.status)}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeadRow}>
            <Text style={[styles.headCell, styles.colDescription]}>Description</Text>
            <Text style={[styles.headCell, styles.colChannel]}>Channel</Text>
            <Text style={[styles.headCell, styles.colQty]}>Qty</Text>
            <Text style={[styles.headCell, styles.colRate]}>Rate</Text>
            <Text style={[styles.headCell, styles.colVat]}>VAT</Text>
            <Text style={[styles.headCell, styles.colTotal]}>Total</Text>
          </View>
          {invoice.lines.map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <View style={styles.colDescription}>
                <Text>{line.description}</Text>
                {line.reading_from !== null && line.reading_to !== null && (
                  <Text style={styles.reading}>
                    Reading {formatNumber(line.reading_from, 1)} → {formatNumber(line.reading_to, 1)}
                  </Text>
                )}
              </View>
              <Text style={styles.colChannel}>{humanise(line.channel)}</Text>
              <Text style={styles.colQty}>{formatNumber(line.quantity, 2)}</Text>
              <Text style={styles.colRate}>{formatMoney(line.unit_price)}</Text>
              <Text style={styles.colVat}>{formatMoney(line.vat_amount)}</Text>
              <Text style={styles.colTotal}>{formatMoney(line.total_amount)}</Text>
            </View>
          ))}
        </View>

        <View style={styles.totals}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{formatMoney(invoice.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>VAT</Text>
            <Text>{formatMoney(invoice.vat_total)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{formatMoney(invoice.total)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Paid</Text>
            <Text>{formatMoney(invoice.amount_paid)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={[styles.totalsLabel, styles.strong]}>Outstanding</Text>
            <Text style={styles.strong}>{formatMoney(invoice.amount_due)}</Text>
          </View>
        </View>

        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated by veriBills</Text>
          <Text style={styles.footerText}>Powered by Bipra</Text>
        </View>
      </Page>
    </Document>
  );
}
