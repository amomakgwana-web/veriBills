/**
 * Integration contracts.
 *
 * Every external dependency the platform has — card acquiring, prepaid token
 * vending, DebiCheck mandates, email, SMS, meter reads — sits behind one of
 * these interfaces. A mock implementation of each ships in-tree so the whole
 * platform runs end to end without third-party credentials; swapping in a real
 * provider means implementing the interface, not touching call sites.
 */

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; code?: string; retryable?: boolean };

// ---------------------------------------------------------------------------
// Card acquiring, with 3-D Secure
// ---------------------------------------------------------------------------

export type ChargeRequest = {
  reference: string;
  amountCents: number;
  currency: string;
  /** Tokenised instrument. Raw PANs never enter this system. */
  instrumentToken?: string;
  holderName?: string;
  description: string;
  /** Where the issuer returns the cardholder after a 3DS challenge. */
  returnUrl: string;
  customer: { id: string; email: string; phone?: string | null };
};

export type ChargeResult = {
  gatewayReference: string;
  status: "authorised" | "requires_3ds" | "failed";
  /** Present when status is requires_3ds: send the browser here. */
  redirectUrl?: string;
  threeDs?: {
    version: string;
    /** frictionless = issuer approved without challenging the cardholder. */
    outcome: "frictionless" | "challenged" | "bypassed";
  };
  failureCode?: string;
  failureReason?: string;
};

export interface PaymentGateway {
  readonly name: string;
  charge(request: ChargeRequest): Promise<Result<ChargeResult>>;
  /** Called when the cardholder returns from the issuer's challenge page. */
  complete3ds(gatewayReference: string, payload: Record<string, string>): Promise<Result<ChargeResult>>;
  refund(gatewayReference: string, amountCents: number): Promise<Result<{ refundReference: string }>>;
}

// ---------------------------------------------------------------------------
// Prepaid electricity token vending (STS)
// ---------------------------------------------------------------------------

export type TokenRequest = {
  meterNumber: string;
  amountCents: number;
  units: number;
  reference: string;
};

export type TokenResult = {
  /** 20-digit STS credit token, formatted in groups of four. */
  token: string;
  units: number;
  vendorReference: string;
  tokenType: "credit" | "key_change" | "clear_tamper" | "clear_credit";
  /** Arrears the vendor recovered off this purchase, in cents. */
  debtRecoveredCents: number;
};

export interface TokenVendor {
  readonly name: string;
  issueToken(request: TokenRequest): Promise<Result<TokenResult>>;
  /** Confirms a meter exists and is vendable before taking money. */
  validateMeter(meterNumber: string): Promise<Result<{ valid: boolean; supplyGroup?: string }>>;
}

// ---------------------------------------------------------------------------
// DebiCheck mandates and collections
// ---------------------------------------------------------------------------

export type MandateRequest = {
  contractReference: string;
  debtorName: string;
  debtorIdNumber?: string | null;
  bankName: string;
  branchCode: string;
  accountNumber: string;
  accountType: "cheque" | "savings" | "transmission";
  instalmentCents: number;
  maximumCents: number;
  collectionDay: number;
  firstCollectionDate: string;
  /** TT1 real-time, TT2 batch, TT3 card-and-PIN at an ATM. */
  authenticationType: "TT1" | "TT2" | "TT3";
};

export type MandateResult = {
  mandateReference: string;
  status: "pending_authentication" | "authenticated" | "rejected";
  /** For TT1, where the debtor authenticates in their banking app. */
  authenticationUrl?: string;
  rejectionReason?: string;
};

export type CollectionRequest = {
  mandateReference: string;
  amountCents: number;
  actionDate: string;
  reference: string;
};

export type CollectionResult = {
  collectionReference: string;
  status: "submitted" | "successful" | "failed";
  responseCode?: string;
  responseReason?: string;
};

export interface DebiCheckProvider {
  readonly name: string;
  createMandate(request: MandateRequest): Promise<Result<MandateResult>>;
  cancelMandate(mandateReference: string, reason: string): Promise<Result<{ cancelled: boolean }>>;
  submitCollection(request: CollectionRequest): Promise<Result<CollectionResult>>;
}

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  replyTo?: string;
  /** Correlates the provider's webhook receipts back to message_deliveries. */
  tag?: string;
};

export type SmsMessage = {
  to: string;
  body: string;
  senderId?: string;
  tag?: string;
};

export type DeliveryReceipt = {
  providerMessageId: string;
  /** SMS billing is per 160-character segment. */
  segments?: number;
  costCents?: number;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<Result<DeliveryReceipt>>;
}

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<Result<DeliveryReceipt>>;
}

// ---------------------------------------------------------------------------
// Meter integration (AMI)
// ---------------------------------------------------------------------------

export type MeterReadingPoll = {
  meterNumber: string;
  reading: number;
  readAt: string;
  isEstimate: boolean;
};

export interface MeterVendor {
  readonly name: string;
  poll(meterNumbers: string[]): Promise<Result<MeterReadingPoll[]>>;
}
