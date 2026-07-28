import { createHash, randomUUID } from "node:crypto";

import type {
  ChargeRequest,
  ChargeResult,
  CollectionRequest,
  CollectionResult,
  DebiCheckProvider,
  DeliveryReceipt,
  EmailMessage,
  EmailProvider,
  MandateRequest,
  MandateResult,
  MeterReadingPoll,
  MeterVendor,
  PaymentGateway,
  Result,
  SmsMessage,
  SmsProvider,
  TokenRequest,
  TokenResult,
  TokenVendor,
} from "./types";

/**
 * Mock integrations.
 *
 * These are deterministic rather than random: behaviour is derived from the
 * request reference, so the same input always produces the same outcome. That
 * makes demos repeatable and lets tests exercise the failure branches on
 * purpose instead of waiting for a flaky roll of the dice.
 *
 * Conventions for triggering specific outcomes in a demo:
 *   amount ending in .13  -> declined
 *   amount ending in .05  -> requires a 3DS challenge
 *   meter number ...0000  -> unknown meter
 */

const ok = <T>(data: T): Result<T> => ({ ok: true, data });
const fail = <T>(error: string, code?: string, retryable = false): Result<T> => ({
  ok: false,
  error,
  code,
  retryable,
});

/** Stable pseudo-random in [0,1) derived from a string. */
function seededUnit(seed: string): number {
  const hash = createHash("sha256").update(seed).digest();
  return hash.readUInt32BE(0) / 0x1_00_00_00_00;
}

function centsSuffix(amountCents: number): number {
  return amountCents % 100;
}

// ---------------------------------------------------------------------------

export class MockPaymentGateway implements PaymentGateway {
  readonly name = "mock";

  async charge(request: ChargeRequest): Promise<Result<ChargeResult>> {
    if (request.amountCents <= 0) {
      return fail("Amount must be greater than zero", "invalid_amount");
    }

    const gatewayReference = `mock_${createHash("sha1")
      .update(request.reference)
      .digest("hex")
      .slice(0, 16)}`;

    const suffix = centsSuffix(request.amountCents);

    if (suffix === 13) {
      return ok({
        gatewayReference,
        status: "failed",
        failureCode: "51",
        failureReason: "Insufficient funds",
      });
    }

    // High-value or explicitly flagged payments get a 3DS challenge; the rest
    // are approved frictionlessly, which is how issuers behave in practice.
    const needsChallenge = suffix === 5 || request.amountCents >= 500_000;

    if (needsChallenge) {
      return ok({
        gatewayReference,
        status: "requires_3ds",
        redirectUrl: `/api/payments/3ds/challenge?ref=${encodeURIComponent(
          gatewayReference,
        )}&return=${encodeURIComponent(request.returnUrl)}`,
        threeDs: { version: "2.2.0", outcome: "challenged" },
      });
    }

    return ok({
      gatewayReference,
      status: "authorised",
      threeDs: { version: "2.2.0", outcome: "frictionless" },
    });
  }

  async complete3ds(
    gatewayReference: string,
    payload: Record<string, string>,
  ): Promise<Result<ChargeResult>> {
    // The challenge page posts back the cardholder's outcome.
    if (payload.outcome === "abandoned") {
      return ok({
        gatewayReference,
        status: "failed",
        failureCode: "3ds_abandoned",
        failureReason: "Cardholder did not complete authentication",
      });
    }

    if (payload.outcome === "failed") {
      return ok({
        gatewayReference,
        status: "failed",
        failureCode: "3ds_failed",
        failureReason: "Authentication failed",
      });
    }

    return ok({
      gatewayReference,
      status: "authorised",
      threeDs: { version: "2.2.0", outcome: "challenged" },
    });
  }

  async refund(gatewayReference: string, amountCents: number) {
    if (amountCents <= 0) return fail<{ refundReference: string }>("Invalid refund amount");
    return ok({ refundReference: `mock_rfnd_${gatewayReference.slice(-8)}` });
  }
}

// ---------------------------------------------------------------------------

export class MockTokenVendor implements TokenVendor {
  readonly name = "mock";

  async validateMeter(meterNumber: string) {
    if (!meterNumber || meterNumber.endsWith("0000")) {
      return fail<{ valid: boolean; supplyGroup?: string }>(
        "Meter not found on the vending system",
        "unknown_meter",
      );
    }
    return ok({ valid: true, supplyGroup: "600192" });
  }

  async issueToken(request: TokenRequest): Promise<Result<TokenResult>> {
    const meter = await this.validateMeter(request.meterNumber);
    if (!meter.ok) return fail<TokenResult>(meter.error, meter.code);

    if (request.units <= 0) {
      return fail<TokenResult>("Purchase does not cover the standing charges", "zero_units");
    }

    // Estates commonly recover arrears off each prepaid purchase. Model a 15%
    // clawback on larger buys so the flow is exercised end to end.
    const debtRecoveredCents =
      request.amountCents >= 20_000 ? Math.round(request.amountCents * 0.15) : 0;

    return ok({
      token: generateStsToken(request.meterNumber, request.reference),
      units: request.units,
      vendorReference: `MOCKV${createHash("sha1")
        .update(request.reference)
        .digest("hex")
        .slice(0, 10)
        .toUpperCase()}`,
      tokenType: "credit",
      debtRecoveredCents,
    });
  }
}

/**
 * Produce a 20-digit STS-shaped credit token.
 *
 * Real STS tokens are encrypted against the meter's key and carry the units,
 * a token identifier and a CRC. This reproduces the shape and the check digit
 * so downstream formatting and validation logic is exercised properly, but it
 * will not vend on physical hardware.
 */
function generateStsToken(meterNumber: string, reference: string): string {
  const digest = createHash("sha256").update(`${meterNumber}:${reference}`).digest();

  let digits = "";
  for (let i = 0; digits.length < 19; i++) {
    digits += (digest[i % digest.length] % 10).toString();
  }

  // Luhn check digit over the first 19, giving a self-validating 20-digit token.
  digits = digits.slice(0, 19);
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    let d = Number(digits[digits.length - 1 - i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
  }
  const check = (10 - (sum % 10)) % 10;

  return `${digits}${check}`.replace(/(\d{4})(?=\d)/g, "$1 ");
}

// ---------------------------------------------------------------------------

export class MockDebiCheckProvider implements DebiCheckProvider {
  readonly name = "mock";

  async createMandate(request: MandateRequest): Promise<Result<MandateResult>> {
    if (request.maximumCents < request.instalmentCents) {
      return fail<MandateResult>(
        "Maximum collection amount cannot be below the instalment",
        "invalid_maximum",
      );
    }

    if (!/^\d{6}$/.test(request.branchCode)) {
      return fail<MandateResult>("Branch code must be six digits", "invalid_branch");
    }

    const mandateReference = `DC${createHash("sha1")
      .update(request.contractReference)
      .digest("hex")
      .slice(0, 12)
      .toUpperCase()}`;

    // TT1 is real-time: the debtor authenticates in their banking app, so the
    // mandate stays pending until they respond. TT2 batches overnight.
    if (request.authenticationType === "TT1") {
      return ok({
        mandateReference,
        status: "pending_authentication",
        authenticationUrl: `/api/debicheck/authenticate?ref=${encodeURIComponent(mandateReference)}`,
      });
    }

    return ok({ mandateReference, status: "authenticated" });
  }

  async cancelMandate(mandateReference: string) {
    if (!mandateReference) return fail<{ cancelled: boolean }>("Mandate reference required");
    return ok({ cancelled: true });
  }

  async submitCollection(request: CollectionRequest): Promise<Result<CollectionResult>> {
    const collectionReference = `COL${createHash("sha1")
      .update(request.reference)
      .digest("hex")
      .slice(0, 12)
      .toUpperCase()}`;

    // Roughly one in eight collections fails, which is realistic for a
    // residential book and keeps the failed-collection workflows exercised.
    const roll = seededUnit(request.reference);

    if (roll < 0.12) {
      const insufficient = roll < 0.09;
      return ok({
        collectionReference,
        status: "failed",
        responseCode: insufficient ? "02" : "05",
        responseReason: insufficient ? "Insufficient funds" : "Account closed",
      });
    }

    return ok({ collectionReference, status: "successful", responseCode: "00" });
  }
}

// ---------------------------------------------------------------------------

export class MockEmailProvider implements EmailProvider {
  readonly name = "mock";

  async send(message: EmailMessage): Promise<Result<DeliveryReceipt>> {
    if (!message.to || !message.to.includes("@")) {
      return fail<DeliveryReceipt>("Invalid recipient address", "invalid_address");
    }
    if (message.to.endsWith("@bounce.test")) {
      return fail<DeliveryReceipt>("Mailbox does not exist", "hard_bounce");
    }
    return ok({ providerMessageId: `mock-email-${randomUUID()}` });
  }
}

export class MockSmsProvider implements SmsProvider {
  readonly name = "mock";

  async send(message: SmsMessage): Promise<Result<DeliveryReceipt>> {
    const msisdn = normaliseMsisdn(message.to);
    if (!msisdn) {
      return fail<DeliveryReceipt>("Invalid mobile number", "invalid_msisdn");
    }

    // GSM-7 messages are billed per 160 characters, 153 once concatenated.
    const length = message.body.length;
    const segments = length <= 160 ? 1 : Math.ceil(length / 153);

    return ok({
      providerMessageId: `mock-sms-${randomUUID()}`,
      segments,
      costCents: segments * 25,
    });
  }
}

/** Normalise a South African mobile number to E.164, or null if implausible. */
export function normaliseMsisdn(input: string): string | null {
  const digits = (input ?? "").replace(/[^\d+]/g, "");

  if (/^\+27\d{9}$/.test(digits)) return digits;
  if (/^27\d{9}$/.test(digits)) return `+${digits}`;
  if (/^0\d{9}$/.test(digits)) return `+27${digits.slice(1)}`;

  return null;
}

// ---------------------------------------------------------------------------

export class MockMeterVendor implements MeterVendor {
  readonly name = "mock";

  async poll(meterNumbers: string[]): Promise<Result<MeterReadingPoll[]>> {
    const readAt = new Date().toISOString();

    return ok(
      meterNumbers.map((meterNumber) => ({
        meterNumber,
        // Deterministic walk so repeated polls in a demo trend sensibly.
        reading: Math.round(seededUnit(`${meterNumber}:${readAt.slice(0, 10)}`) * 5000 * 1000) / 1000,
        readAt,
        isEstimate: false,
      })),
    );
  }
}
