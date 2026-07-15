import { z } from "zod";

// The 8 platform roles from the Technical Platform Document v3.0,
// Sections 3.3/4.3/5.3 — mirrored exactly in db/002_auth_and_rls.sql's
// RLS policies. Keep this list and that file's role checks in sync.
export const VB_ROLES = [
  "tenant",
  "sysadmin",
  "data_admin",
  "data_analyst",
  "compliance_officer",
  "landlord",
  "estate_manager",
  "it_admin",
] as const;
export const vbRoleSchema = z.enum(VB_ROLES);
export type VbRole = z.infer<typeof vbRoleSchema>;

// Shape of the JWT claims public.custom_access_token_hook injects for a
// veriBills user (db/002/003). `app` distinguishes this session from any
// other product sharing the same Supabase project's Auth.
export interface VbClaims {
  app: "veribills";
  role: VbRole;
  name: string;
  tenantUnitId?: string;
}

export interface Estate {
  id: string;
  name: string;
  address: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  createdAt: string;
}

export interface Unit {
  id: string;
  estateId: string;
  unitNumber: string;
  createdAt: string;
}

export interface VbUser {
  id: string;
  email: string;
  name: string;
  role: VbRole;
  tenantUnitId: string | null;
  createdAt: string;
}

export interface Lease {
  id: string;
  unitId: string;
  tenantUserId: string | null;
  rentAmount: number;
  startDate: string;
  endDate: string | null;
  status: "active" | "ended";
  createdAt: string;
}

export interface TenantInvite {
  id: string;
  unitId: string;
  leaseId: string;
  email: string;
  token: string;
  invitedBy: string;
  status: "pending" | "activated" | "expired";
  createdAt: string;
  activatedAt: string | null;
}

export interface Tariff {
  id: number;
  code: string;
  description: string;
  waterPerKl: number;
  electricityPerKwh: number;
  vatRate: number;
  validFrom: string;
  validTo: string | null;
}

export type MeterType = "water" | "prepaid_electricity" | "metered_electricity";

export interface Meter {
  id: string;
  unitId: string;
  type: MeterType;
  serial: string;
  lastReading: number;
  lastReadingAt: string;
  status: "normal" | "fault";
}

export interface Reading {
  id: number;
  meterId: string;
  reading: number;
  readAt: string;
}

export interface PrepaidToken {
  id: string;
  meterId: string;
  unitId: string;
  amount: number;
  units: number;
  token: string;
  vendedAt: string;
}

export interface LoadsheddingSchedule {
  id: number;
  estateId: string;
  stage: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

export type InvoiceStatus = "pending" | "paid" | "overdue" | "disputed";

export interface Invoice {
  id: string;
  unitId: string;
  leaseId: string;
  billingPeriod: string;
  issueDate: string;
  dueDate: string;
  totalAmount: number;
  amountPaid: number;
  status: InvoiceStatus;
  createdAt: string;
}

export type InvoiceLineCategory = "rent" | "levy" | "charge" | "water" | "electricity" | "other";

export interface InvoiceLine {
  id: number;
  invoiceId: string;
  category: InvoiceLineCategory;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface CreditNote {
  id: string;
  invoiceId: string;
  amount: number;
  reason: string;
  issuedBy: string;
  createdAt: string;
}

export type DisputeStatus = "open" | "under_review" | "resolved" | "rejected";

export interface Dispute {
  id: string;
  invoiceId: string;
  unitId: string;
  reason: string;
  description: string;
  status: DisputeStatus;
  resolutionNote: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface DunningLogEntry {
  id: number;
  invoiceId: string;
  unitId: string;
  channel: "email" | "sms";
  message: string;
  sentAt: string;
}

export interface PaymentTransaction {
  ref: string;
  unitId: string;
  invoiceId: string | null;
  amount: number;
  method: "eft" | "card" | "debit_order";
  status: "matched" | "suspense" | "failed";
  erpStatus: "pending" | "posted";
  createdAt: string;
}

export type ArrearsStage = "open" | "contacted" | "payment_plan" | "legal_escalation" | "resolved" | "written_off";

export interface ArrearsCase {
  id: string;
  unitId: string;
  invoiceId: string | null;
  stage: ArrearsStage;
  assignedTo: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ArrearsCaseHistoryEntry {
  id: number;
  caseId: string;
  fromStage: ArrearsStage | null;
  toStage: ArrearsStage;
  actor: string;
  note: string | null;
  createdAt: string;
}

export interface LegalEscalation {
  id: string;
  caseId: string;
  status: "referred" | "in_progress" | "judgment" | "resolved";
  notes: string | null;
  createdAt: string;
}

export interface PaymentPlan {
  id: string;
  unitId: string;
  invoiceId: string | null;
  totalAmount: number;
  installments: number;
  installmentAmount: number;
  startDate: string;
  status: "active" | "completed" | "cancelled";
  createdAt: string;
}

export interface StatementTemplate {
  id: string;
  estateId: string | null;
  name: string;
  htmlContent: string;
  updatedBy: string;
  updatedAt: string;
}

export interface EventLogEntry {
  id: number;
  eventType: string;
  source: "xbilling" | "xutilities" | "xlayer";
  actor: string | null;
  payload: Record<string, unknown>;
  createdAt: string;
}

export interface WebhookEndpoint {
  id: string;
  name: string;
  url: string;
  active: boolean;
  createdAt: string;
}

export interface WebhookDelivery {
  id: number;
  eventId: number;
  endpointId: string;
  status: "pending" | "delivered" | "failed";
  responseCode: number | null;
  error: string | null;
  attemptedAt: string | null;
}
