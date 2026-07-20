"use client";

import { useCallback, useEffect, useState } from "react";
import type { Dispute, Estate, Invoice, InvoiceLine, Lease, Meter, PrepaidToken, Unit } from "@veribills/shared-types";
import { Badge, Button, Card, EmptyState, Input, T, fmtR } from "@veribills/ui-kit";
import { useAuth } from "../../auth/AuthContext";
import { supabase } from "../../lib/supabaseClient";
import { callRpc, unwrap } from "../../lib/db";

interface InvoiceWithLines extends Invoice {
  lines: InvoiceLine[];
}

const STATUS_TONE: Record<Invoice["status"], "neutral" | "green" | "red" | "amber"> = {
  pending: "neutral",
  paid: "green",
  overdue: "red",
  disputed: "amber",
};

function InvoiceCard({
  invoice,
  onPay,
  onDispute,
  busy,
}: {
  invoice: InvoiceWithLines;
  onPay: (invoiceId: string, amount: number) => Promise<void>;
  onDispute: (invoiceId: string, reason: string, description: string) => Promise<void>;
  busy: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [disputing, setDisputing] = useState(false);
  const [reason, setReason] = useState("");
  const [description, setDescription] = useState("");
  const outstanding = invoice.totalAmount - invoice.amountPaid;

  return (
    <Card style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 600 }}>{invoice.billingPeriod}</div>
          <div style={{ fontSize: 12, color: T.white3 }}>Due {invoice.dueDate}</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Badge tone={STATUS_TONE[invoice.status]}>{invoice.status}</Badge>
          <div style={{ fontWeight: 700 }}>{fmtR(invoice.totalAmount)}</div>
        </div>
      </div>

      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
        <Button variant="ghost" onClick={() => setExpanded((v) => !v)}>
          {expanded ? "Hide details" : "View details"}
        </Button>
        {invoice.status !== "paid" ? (
          <Button variant="primary" disabled={busy} onClick={() => onPay(invoice.id, outstanding)}>
            Pay {fmtR(outstanding)}
          </Button>
        ) : null}
        {invoice.status !== "paid" ? (
          <Button variant="secondary" onClick={() => setDisputing((v) => !v)}>
            Raise dispute
          </Button>
        ) : null}
      </div>

      {expanded ? (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.white5}`, paddingTop: 12 }}>
          {invoice.lines.map((line) => (
            <div key={line.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: T.white2 }}>{line.description}</span>
              <span>{fmtR(line.amount)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {disputing ? (
        <div style={{ marginTop: 12, borderTop: `1px solid ${T.white5}`, paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
          <Input placeholder="Reason (e.g. incorrect reading)" value={reason} onChange={(e) => setReason(e.target.value)} />
          <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button
            disabled={busy || !reason || !description}
            onClick={async () => {
              await onDispute(invoice.id, reason, description);
              setDisputing(false);
              setReason("");
              setDescription("");
            }}
          >
            Submit dispute
          </Button>
        </div>
      ) : null}
    </Card>
  );
}

export function XBillingDashboard() {
  const { session } = useAuth();
  const [unit, setUnit] = useState<Unit | null>(null);
  const [estate, setEstate] = useState<Estate | null>(null);
  const [lease, setLease] = useState<Lease | null>(null);
  const [invoices, setInvoices] = useState<InvoiceWithLines[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [prepaidTokens, setPrepaidTokens] = useState<PrepaidToken[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [buyAmount, setBuyAmount] = useState("");

  const load = useCallback(async () => {
    if (!session?.tenantUnitId) return;
    setLoading(true);
    setError(null);
    try {
      const unitRow = await unwrap<Unit>(supabase.from("vb_units").select("*").eq("id", session.tenantUnitId).single());
      setUnit(unitRow);

      const [estateRow, leaseRows, invoiceRows, meterRows, tokenRows, disputeRows] = await Promise.all([
        unwrap<Estate>(supabase.from("vb_estates").select("*").eq("id", unitRow.estateId).single()),
        unwrap<Lease[]>(supabase.from("vb_leases").select("*").eq("unitId", session.tenantUnitId).eq("status", "active")),
        unwrap<Invoice[]>(supabase.from("vb_invoices").select("*").eq("unitId", session.tenantUnitId).order("billingPeriod", { ascending: false })),
        unwrap<Meter[]>(supabase.from("vb_meters").select("*").eq("unitId", session.tenantUnitId)),
        unwrap<PrepaidToken[]>(supabase.from("vb_prepaid_tokens").select("*").eq("unitId", session.tenantUnitId).order("vendedAt", { ascending: false })),
        unwrap<Dispute[]>(supabase.from("vb_disputes").select("*").eq("unitId", session.tenantUnitId)),
      ]);

      setEstate(estateRow);
      setLease(leaseRows[0] ?? null);
      setMeters(meterRows);
      setPrepaidTokens(tokenRows);
      setDisputes(disputeRows);

      const invoiceIds = invoiceRows.map((i) => i.id);
      const lines = invoiceIds.length
        ? await unwrap<InvoiceLine[]>(supabase.from("vb_invoice_lines").select("*").in("invoiceId", invoiceIds))
        : [];
      setInvoices(invoiceRows.map((inv) => ({ ...inv, lines: lines.filter((l) => l.invoiceId === inv.id) })));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load your statement");
    } finally {
      setLoading(false);
    }
  }, [session?.tenantUnitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handlePay = async (invoiceId: string, amount: number) => {
    setBusy(true);
    setError(null);
    try {
      await callRpc("vb_mock_bipra_pay_charge", { p_invoice_id: invoiceId, p_amount: amount, p_method: "card" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setBusy(false);
    }
  };

  const handleDispute = async (invoiceId: string, reason: string, description: string) => {
    setBusy(true);
    setError(null);
    try {
      await callRpc("vb_create_dispute", { p_invoice_id: invoiceId, p_reason: reason, p_description: description });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit dispute");
    } finally {
      setBusy(false);
    }
  };

  const prepaidMeter = meters.find((m) => m.type === "prepaid_electricity");

  const handleBuyElectricity = async () => {
    const amount = Number(buyAmount);
    if (!prepaidMeter || !amount || amount <= 0) return;
    setBusy(true);
    setError(null);
    try {
      await callRpc("vb_vend_prepaid_token", { p_meter_id: prepaidMeter.id, p_amount: amount });
      setBuyAmount("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Purchase failed");
    } finally {
      setBusy(false);
    }
  };

  if (!session?.tenantUnitId) {
    return (
      <Card>
        <EmptyState title="No unit linked" hint="This account isn't linked to a unit yet — contact your estate manager." />
      </Card>
    );
  }

  if (loading) return null;

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 720 }}>
      <Card>
        <div style={{ fontSize: 18, fontWeight: 700 }}>{estate?.name ?? "Your estate"}</div>
        <div style={{ color: T.white3, fontSize: 13 }}>
          Unit {unit?.unitNumber} · {session.name}
          {lease ? ` · Rent ${fmtR(lease.rentAmount)}/month` : ""}
        </div>
      </Card>

      {error ? (
        <Card style={{ borderColor: T.redR }}>
          <div style={{ color: T.redT, fontSize: 13 }}>{error}</div>
        </Card>
      ) : null}

      {prepaidMeter ? (
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Prepaid electricity</div>
          <div style={{ display: "flex", gap: 8, marginBottom: prepaidTokens.length ? 12 : 0 }}>
            <Input
              type="number"
              placeholder="Amount (R)"
              value={buyAmount}
              onChange={(e) => setBuyAmount(e.target.value)}
              style={{ maxWidth: 160 }}
            />
            <Button disabled={busy || !buyAmount} onClick={handleBuyElectricity}>
              Buy electricity
            </Button>
          </div>
          {prepaidTokens.slice(0, 5).map((tok) => (
            <div key={tok.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: T.white2, marginBottom: 4 }}>
              <span>{new Date(tok.vendedAt).toLocaleDateString()}</span>
              <span>
                {fmtR(tok.amount)} → {tok.units} kWh — <code>{tok.token}</code>
              </span>
            </div>
          ))}
        </Card>
      ) : null}

      <div>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>Statement</div>
        {invoices.length === 0 ? (
          <Card>
            <EmptyState title="No invoices yet" hint="Your statements will appear here once your estate issues a billing run." />
          </Card>
        ) : (
          invoices.map((inv) => <InvoiceCard key={inv.id} invoice={inv} onPay={handlePay} onDispute={handleDispute} busy={busy} />)
        )}
      </div>

      {disputes.length > 0 ? (
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Your disputes</div>
          {disputes.map((d) => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
              <span style={{ color: T.white2 }}>{d.reason}</span>
              <Badge tone={d.status === "resolved" ? "green" : d.status === "rejected" ? "red" : "amber"}>{d.status}</Badge>
            </div>
          ))}
        </Card>
      ) : null}
    </div>
  );
}
