"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type {
  ArrearsCase,
  Dispute,
  Estate,
  Invoice,
  Meter,
  Tariff,
  TenantInvite,
  Unit,
  VbRole,
} from "@veribills/shared-types";
import { Badge, Button, Card, EmptyState, Input, Select, T, fmtR } from "@veribills/ui-kit";
import { useAuth } from "../../auth/AuthContext";
import { ROLE_META } from "../../auth/session";
import { supabase } from "../../lib/supabaseClient";
import { callRpc, unwrap } from "../../lib/db";

// Mirrors the role checks each RPC in db/005 makes server-side — these
// constants only decide whether a button/form renders, never whether an
// action is actually allowed. RLS + the RPCs themselves are the real gate;
// hiding controls a role can't use is purely to avoid a confusing 42501
// round-trip.
const CAN_INVITE_TENANT: VbRole[] = ["sysadmin", "landlord", "estate_manager"];
const CAN_RUN_BILLING: VbRole[] = ["sysadmin", "landlord", "estate_manager"];
const CAN_SEND_DUNNING: VbRole[] = ["sysadmin", "estate_manager"];
const CAN_RESOLVE_DISPUTE: VbRole[] = ["sysadmin", "estate_manager"];
const CAN_ISSUE_CREDIT_NOTE: VbRole[] = ["sysadmin", "estate_manager"];
const CAN_MOVE_ARREARS: VbRole[] = ["sysadmin", "estate_manager"];
const CAN_ESCALATE_LEGAL: VbRole[] = ["sysadmin", "estate_manager"];
const CAN_CREATE_PAYMENT_PLAN: VbRole[] = ["sysadmin", "estate_manager"];
const CAN_CREATE_TARIFF: VbRole[] = ["sysadmin", "data_admin"];
const CAN_INGEST_READING: VbRole[] = ["sysadmin", "data_admin", "estate_manager"];

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "tenants", label: "Tenants" },
  { key: "billing", label: "Billing" },
  { key: "disputes", label: "Disputes" },
  { key: "arrears", label: "Arrears" },
  { key: "tariffs", label: "Tariffs" },
  { key: "metering", label: "Metering" },
] as const;
type TabKey = (typeof TABS)[number]["key"];

const ARREARS_STAGES: ArrearsCase["stage"][] = ["open", "contacted", "payment_plan", "legal_escalation", "resolved", "written_off"];
const STAGE_LABEL: Record<ArrearsCase["stage"], string> = {
  open: "Open",
  contacted: "Contacted",
  payment_plan: "Payment plan",
  legal_escalation: "Legal escalation",
  resolved: "Resolved",
  written_off: "Written off",
};
const STAGE_TONE: Record<ArrearsCase["stage"], "neutral" | "green" | "red" | "amber"> = {
  open: "neutral",
  contacted: "amber",
  payment_plan: "amber",
  legal_escalation: "red",
  resolved: "green",
  written_off: "neutral",
};
const NEXT_STAGE: Partial<Record<ArrearsCase["stage"], ArrearsCase["stage"]>> = {
  open: "contacted",
  contacted: "payment_plan",
  payment_plan: "legal_escalation",
  legal_escalation: "resolved",
};

const INVOICE_STATUS_TONE: Record<Invoice["status"], "neutral" | "green" | "red" | "amber"> = {
  pending: "neutral",
  paid: "green",
  overdue: "red",
  disputed: "amber",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function XUtilitiesDashboard() {
  const { session } = useAuth();
  const role = session?.role;

  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [estates, setEstates] = useState<Estate[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [arrearsCases, setArrearsCases] = useState<ArrearsCase[]>([]);
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [meters, setMeters] = useState<Meter[]>([]);
  const [tenantInvites, setTenantInvites] = useState<TenantInvite[]>([]);

  // Form state
  const [selectedEstateId, setSelectedEstateId] = useState("");
  const [inviteUnitId, setInviteUnitId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRent, setInviteRent] = useState("");
  const [tariffForm, setTariffForm] = useState({ code: "standard", description: "", water: "", electricity: "", vat: "0.15", validFrom: todayIso() });
  const [readingForm, setReadingForm] = useState({ meterId: "", reading: "" });

  const unitLabel = useMemo(() => {
    const estateById = new Map(estates.map((e) => [e.id, e.name]));
    const map = new Map<string, string>();
    for (const u of units) map.set(u.id, `${estateById.get(u.estateId) ?? u.estateId} · Unit ${u.unitNumber}`);
    return map;
  }, [estates, units]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [estateRows, unitRows, invoiceRows, disputeRows, arrearsRows, tariffRows, meterRows, inviteRows] = await Promise.all([
        unwrap<Estate[]>(supabase.from("vb_estates").select("*").order("name")),
        unwrap<Unit[]>(supabase.from("vb_units").select("*").order("unitNumber")),
        unwrap<Invoice[]>(supabase.from("vb_invoices").select("*").order("createdAt", { ascending: false }).limit(200)),
        unwrap<Dispute[]>(supabase.from("vb_disputes").select("*").order("createdAt", { ascending: false }).limit(200)),
        unwrap<ArrearsCase[]>(supabase.from("vb_arrears_cases").select("*").order("updatedAt", { ascending: false }).limit(200)),
        unwrap<Tariff[]>(supabase.from("vb_tariffs").select("*").order("validFrom", { ascending: false })),
        unwrap<Meter[]>(supabase.from("vb_meters").select("*").order("id")),
        unwrap<TenantInvite[]>(supabase.from("vb_tenant_invites").select("*").order("createdAt", { ascending: false }).limit(200)),
      ]);
      setEstates(estateRows);
      setUnits(unitRows);
      setInvoices(invoiceRows);
      setDisputes(disputeRows);
      setArrearsCases(arrearsRows);
      setTariffs(tariffRows);
      setMeters(meterRows);
      setTenantInvites(inviteRows);
      setSelectedEstateId((prev) => prev || estateRows[0]?.id || "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load back-office data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const withBusy = async (fn: () => Promise<void>, successNotice?: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await fn();
      if (successNotice) setNotice(successNotice);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBusy(false);
    }
  };

  const unitsForEstate = (estateId: string) => units.filter((u) => u.estateId === estateId);

  const handleInviteTenant = () =>
    withBusy(async () => {
      if (!inviteUnitId || !inviteEmail || !inviteRent) return;
      await callRpc("vb_invite_tenant", {
        p_unit_id: inviteUnitId,
        p_email: inviteEmail,
        p_rent_amount: Number(inviteRent),
      });
      setInviteEmail("");
      setInviteRent("");
      await load();
    }, "Invite sent — the tenant can activate from the link once emailed to them.");

  const handleRunBilling = () =>
    withBusy(async () => {
      if (!selectedEstateId) return;
      const created = await callRpc<Invoice[]>("vb_run_billing_period", { p_estate_id: selectedEstateId });
      await load();
      setNotice(`Billing run complete — ${created.length} invoice(s) for this period.`);
    });

  const handleFlagOverdue = () =>
    withBusy(async () => {
      if (!selectedEstateId) return;
      const cases = await callRpc<ArrearsCase[]>("vb_flag_overdue_invoices", { p_estate_id: selectedEstateId });
      await load();
      setNotice(`Overdue sweep complete — ${cases.length} arrears case(s) open for this estate.`);
    });

  const handleSendDunning = (invoiceId: string) =>
    withBusy(async () => {
      await callRpc("vb_send_dunning_reminder", {
        p_invoice_id: invoiceId,
        p_channel: "email",
        p_message: "Your account has an outstanding balance — please make payment to avoid further action.",
      });
      await load();
    }, "Reminder logged.");

  const handleResolveDispute = (id: string, status: Dispute["status"]) =>
    withBusy(async () => {
      const note = status === "rejected" ? "Rejected after review." : "Resolved after review.";
      await callRpc("vb_resolve_dispute", { p_id: id, p_status: status, p_resolution_note: note });
      await load();
    });

  const handleIssueCreditNote = (invoiceId: string, amount: number, reason: string) =>
    withBusy(async () => {
      await callRpc("vb_issue_credit_note", { p_invoice_id: invoiceId, p_amount: amount, p_reason: reason });
      await load();
    }, "Credit note issued.");

  const handleMoveArrears = (caseId: string, toStage: ArrearsCase["stage"]) =>
    withBusy(async () => {
      await callRpc("vb_move_arrears_case", { p_case_id: caseId, p_to_stage: toStage });
      await load();
    });

  const handleEscalateLegal = (caseId: string) =>
    withBusy(async () => {
      await callRpc("vb_escalate_to_legal", { p_case_id: caseId, p_notes: "Referred to legal for collections." });
      await load();
    }, "Referred to legal.");

  const handleCreatePaymentPlan = (unitId: string, invoiceId: string, totalAmount: number) =>
    withBusy(async () => {
      await callRpc("vb_create_payment_plan", {
        p_unit_id: unitId,
        p_invoice_id: invoiceId,
        p_total_amount: totalAmount,
        p_installments: 3,
      });
      await load();
    }, "3-month payment plan created.");

  const handleCreateTariff = () =>
    withBusy(async () => {
      if (!tariffForm.code || !tariffForm.description) return;
      await callRpc("vb_create_tariff", {
        p_code: tariffForm.code,
        p_description: tariffForm.description,
        p_water_per_kl: Number(tariffForm.water || 0),
        p_electricity_per_kwh: Number(tariffForm.electricity || 0),
        p_vat_rate: Number(tariffForm.vat || 0.15),
        p_valid_from: tariffForm.validFrom,
      });
      setTariffForm({ code: "standard", description: "", water: "", electricity: "", vat: "0.15", validFrom: todayIso() });
      await load();
    }, "Tariff published.");

  const handleIngestReading = () =>
    withBusy(async () => {
      if (!readingForm.meterId || !readingForm.reading) return;
      await callRpc("vb_ingest_meter_reading", { p_meter_id: readingForm.meterId, p_reading: Number(readingForm.reading) });
      setReadingForm({ meterId: "", reading: "" });
      await load();
    }, "Reading recorded.");

  if (loading) return null;

  const openArrears = arrearsCases.filter((c) => c.stage !== "resolved" && c.stage !== "written_off");
  const overdueInvoices = invoices.filter((i) => i.status === "overdue");
  const openDisputes = disputes.filter((d) => d.status === "open" || d.status === "under_review");

  return (
    <div style={{ display: "grid", gap: 16, maxWidth: 1000 }}>
      <Card>
        <div style={{ fontSize: 18, fontWeight: 700 }}>xUtilities back office</div>
        <div style={{ color: T.white3, fontSize: 13 }}>
          {session?.name} · {role ? ROLE_META[role].label : ""}
        </div>
      </Card>

      {error ? (
        <Card style={{ borderColor: T.redR }}>
          <div style={{ color: T.redT, fontSize: 13 }}>{error}</div>
        </Card>
      ) : null}
      {notice ? (
        <Card style={{ borderColor: T.greenR }}>
          <div style={{ color: T.greenT, fontSize: 13 }}>{notice}</div>
        </Card>
      ) : null}

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", borderBottom: `1px solid ${T.white5}`, paddingBottom: 8 }}>
        {TABS.map((t) => (
          <Button key={t.key} variant={tab === t.key ? "primary" : "ghost"} onClick={() => setTab(t.key)}>
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "overview" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12 }}>
          <Card>
            <div style={{ fontSize: 12, color: T.white3 }}>Estates</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{estates.length}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: T.white3 }}>Units</div>
            <div style={{ fontSize: 24, fontWeight: 700 }}>{units.length}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: T.white3 }}>Overdue invoices</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: overdueInvoices.length ? T.redT : T.white }}>{overdueInvoices.length}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: T.white3 }}>Open disputes</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: openDisputes.length ? T.amberT : T.white }}>{openDisputes.length}</div>
          </Card>
          <Card>
            <div style={{ fontSize: 12, color: T.white3 }}>Active arrears cases</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: openArrears.length ? T.amberT : T.white }}>{openArrears.length}</div>
          </Card>
        </div>
      ) : null}

      {tab === "tenants" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {CAN_INVITE_TENANT.includes(role as VbRole) ? (
            <Card>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Invite a tenant</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 8 }}>
                <Select value={inviteUnitId} onChange={(e) => setInviteUnitId(e.target.value)}>
                  <option value="">Select unit…</option>
                  {units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {unitLabel.get(u.id) ?? u.id}
                    </option>
                  ))}
                </Select>
                <Input placeholder="Rent amount (R)" type="number" value={inviteRent} onChange={(e) => setInviteRent(e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Input placeholder="Tenant email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                <Button disabled={busy || !inviteUnitId || !inviteEmail || !inviteRent} onClick={handleInviteTenant}>
                  Send invite
                </Button>
              </div>
            </Card>
          ) : null}

          <Card>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Tenant invites</div>
            {tenantInvites.length === 0 ? (
              <EmptyState title="No invites yet" />
            ) : (
              tenantInvites.map((inv) => (
                <div key={inv.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6, alignItems: "center" }}>
                  <span style={{ color: T.white2 }}>
                    {inv.email} — {unitLabel.get(inv.unitId) ?? inv.unitId}
                  </span>
                  <Badge tone={inv.status === "activated" ? "green" : inv.status === "expired" ? "red" : "amber"}>{inv.status}</Badge>
                </div>
              ))
            )}
          </Card>
        </div>
      ) : null}

      {tab === "billing" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {CAN_RUN_BILLING.includes(role as VbRole) ? (
            <Card>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Billing operations</div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Select value={selectedEstateId} onChange={(e) => setSelectedEstateId(e.target.value)} style={{ maxWidth: 260 }}>
                  {estates.map((e) => (
                    <option key={e.id} value={e.id}>
                      {e.name}
                    </option>
                  ))}
                </Select>
                <Button disabled={busy || !selectedEstateId} onClick={handleRunBilling}>
                  Run billing period
                </Button>
                <Button variant="secondary" disabled={busy || !selectedEstateId} onClick={handleFlagOverdue}>
                  Flag overdue invoices
                </Button>
              </div>
            </Card>
          ) : null}

          <Card>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Invoices</div>
            {invoices.length === 0 ? (
              <EmptyState title="No invoices yet" />
            ) : (
              invoices.map((inv) => (
                <div key={inv.id} style={{ borderTop: `1px solid ${T.white5}`, padding: "10px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>{unitLabel.get(inv.unitId) ?? inv.unitId}</div>
                      <div style={{ fontSize: 12, color: T.white3 }}>
                        {inv.billingPeriod} · Due {inv.dueDate}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <Badge tone={INVOICE_STATUS_TONE[inv.status]}>{inv.status}</Badge>
                      <div style={{ fontWeight: 700, fontSize: 13 }}>
                        {fmtR(inv.amountPaid)} / {fmtR(inv.totalAmount)}
                      </div>
                    </div>
                  </div>
                  {inv.status !== "paid" && CAN_SEND_DUNNING.includes(role as VbRole) ? (
                    <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                      <Button variant="ghost" disabled={busy} onClick={() => handleSendDunning(inv.id)}>
                        Send dunning reminder
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={busy || !CAN_ISSUE_CREDIT_NOTE.includes(role as VbRole)}
                        onClick={() => handleIssueCreditNote(inv.id, Math.round((inv.totalAmount - inv.amountPaid) * 0.1 * 100) / 100, "Goodwill adjustment")}
                      >
                        Issue 10% credit note
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </Card>
        </div>
      ) : null}

      {tab === "disputes" ? (
        <Card>
          <div style={{ fontWeight: 600, marginBottom: 8 }}>Disputes</div>
          {disputes.length === 0 ? (
            <EmptyState title="No disputes" hint="Tenant-raised billing disputes will appear here." />
          ) : (
            disputes.map((d) => (
              <div key={d.id} style={{ borderTop: `1px solid ${T.white5}`, padding: "10px 0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 13 }}>{d.reason}</div>
                    <div style={{ fontSize: 12, color: T.white3 }}>
                      {unitLabel.get(d.unitId) ?? d.unitId} · {d.description}
                    </div>
                  </div>
                  <Badge tone={d.status === "resolved" ? "green" : d.status === "rejected" ? "red" : "amber"}>{d.status}</Badge>
                </div>
                {(d.status === "open" || d.status === "under_review") && CAN_RESOLVE_DISPUTE.includes(role as VbRole) ? (
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    {d.status === "open" ? (
                      <Button variant="ghost" disabled={busy} onClick={() => handleResolveDispute(d.id, "under_review")}>
                        Start review
                      </Button>
                    ) : null}
                    <Button variant="secondary" disabled={busy} onClick={() => handleResolveDispute(d.id, "resolved")}>
                      Resolve
                    </Button>
                    <Button variant="ghost" disabled={busy} onClick={() => handleResolveDispute(d.id, "rejected")}>
                      Reject
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </Card>
      ) : null}

      {tab === "arrears" ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {ARREARS_STAGES.map((stage) => {
            const cases = arrearsCases.filter((c) => c.stage === stage);
            return (
              <Card key={stage}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                  <Badge tone={STAGE_TONE[stage]}>{STAGE_LABEL[stage]}</Badge>
                  <span style={{ color: T.white3, fontSize: 12 }}>{cases.length}</span>
                </div>
                {cases.length === 0 ? (
                  <div style={{ color: T.white4, fontSize: 12 }}>—</div>
                ) : (
                  cases.map((c) => (
                    <div key={c.id} style={{ borderTop: `1px solid ${T.white5}`, padding: "8px 0" }}>
                      <div style={{ fontSize: 12, fontWeight: 600 }}>{unitLabel.get(c.unitId) ?? c.unitId}</div>
                      <div style={{ fontSize: 11, color: T.white3, marginBottom: 6 }}>{c.invoiceId ?? "—"}</div>
                      {CAN_MOVE_ARREARS.includes(role as VbRole) ? (
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {NEXT_STAGE[stage] ? (
                            <Button variant="ghost" disabled={busy} onClick={() => handleMoveArrears(c.id, NEXT_STAGE[stage]!)}>
                              → {STAGE_LABEL[NEXT_STAGE[stage]!]}
                            </Button>
                          ) : null}
                          {stage === "legal_escalation" && CAN_ESCALATE_LEGAL.includes(role as VbRole) ? (
                            <Button variant="ghost" disabled={busy} onClick={() => handleEscalateLegal(c.id)}>
                              Refer to legal
                            </Button>
                          ) : null}
                          {stage === "open" && c.invoiceId && CAN_CREATE_PAYMENT_PLAN.includes(role as VbRole) ? (
                            <Button
                              variant="ghost"
                              disabled={busy}
                              onClick={() => {
                                const inv = invoices.find((i) => i.id === c.invoiceId);
                                if (inv) void handleCreatePaymentPlan(c.unitId, inv.id, inv.totalAmount - inv.amountPaid);
                              }}
                            >
                              3-month plan
                            </Button>
                          ) : null}
                          {stage !== "written_off" && stage !== "resolved" ? (
                            <Button variant="ghost" disabled={busy} onClick={() => handleMoveArrears(c.id, "written_off")}>
                              Write off
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ))
                )}
              </Card>
            );
          })}
        </div>
      ) : null}

      {tab === "tariffs" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {CAN_CREATE_TARIFF.includes(role as VbRole) ? (
            <Card>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Publish a tariff</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8, marginBottom: 8 }}>
                <Input placeholder="Code (e.g. standard)" value={tariffForm.code} onChange={(e) => setTariffForm({ ...tariffForm, code: e.target.value })} />
                <Input placeholder="Description" value={tariffForm.description} onChange={(e) => setTariffForm({ ...tariffForm, description: e.target.value })} />
                <Input placeholder="Water R/kL" type="number" value={tariffForm.water} onChange={(e) => setTariffForm({ ...tariffForm, water: e.target.value })} />
                <Input placeholder="Electricity R/kWh" type="number" value={tariffForm.electricity} onChange={(e) => setTariffForm({ ...tariffForm, electricity: e.target.value })} />
                <Input placeholder="VAT rate (0.15)" type="number" value={tariffForm.vat} onChange={(e) => setTariffForm({ ...tariffForm, vat: e.target.value })} />
                <Input type="date" value={tariffForm.validFrom} onChange={(e) => setTariffForm({ ...tariffForm, validFrom: e.target.value })} />
              </div>
              <Button disabled={busy || !tariffForm.code || !tariffForm.description} onClick={handleCreateTariff}>
                Publish tariff
              </Button>
            </Card>
          ) : null}

          <Card>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Tariff schedule</div>
            {tariffs.length === 0 ? (
              <EmptyState title="No tariffs configured" />
            ) : (
              tariffs.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: `1px solid ${T.white5}`, padding: "8px 0" }}>
                  <span style={{ color: T.white2 }}>
                    {t.code} — {t.description}
                    {t.validTo ? null : <Badge tone="green">current</Badge>}
                  </span>
                  <span style={{ color: T.white3 }}>
                    Water {fmtR(t.waterPerKl)}/kL · Elec {fmtR(t.electricityPerKwh)}/kWh · VAT {Math.round(t.vatRate * 100)}%
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      ) : null}

      {tab === "metering" ? (
        <div style={{ display: "grid", gap: 12 }}>
          {CAN_INGEST_READING.includes(role as VbRole) ? (
            <Card>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Capture a meter reading</div>
              <div style={{ display: "flex", gap: 8 }}>
                <Select value={readingForm.meterId} onChange={(e) => setReadingForm({ ...readingForm, meterId: e.target.value })}>
                  <option value="">Select meter…</option>
                  {meters
                    .filter((m) => m.type !== "prepaid_electricity")
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.serial} ({m.type}) — {unitLabel.get(m.unitId) ?? m.unitId}
                      </option>
                    ))}
                </Select>
                <Input
                  placeholder="Reading"
                  type="number"
                  value={readingForm.reading}
                  onChange={(e) => setReadingForm({ ...readingForm, reading: e.target.value })}
                  style={{ maxWidth: 140 }}
                />
                <Button disabled={busy || !readingForm.meterId || !readingForm.reading} onClick={handleIngestReading}>
                  Record
                </Button>
              </div>
            </Card>
          ) : null}

          <Card>
            <div style={{ fontWeight: 600, marginBottom: 8 }}>Meters</div>
            {meters.length === 0 ? (
              <EmptyState title="No meters" />
            ) : (
              meters.map((m) => (
                <div key={m.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, borderTop: `1px solid ${T.white5}`, padding: "8px 0" }}>
                  <span style={{ color: T.white2 }}>
                    {m.serial} ({m.type}) — {unitLabel.get(m.unitId) ?? m.unitId}
                  </span>
                  <span style={{ color: T.white3 }}>
                    {m.lastReading} · <Badge tone={m.status === "fault" ? "red" : "green"}>{m.status}</Badge>
                  </span>
                </div>
              ))
            )}
          </Card>
        </div>
      ) : null}
    </div>
  );
}
