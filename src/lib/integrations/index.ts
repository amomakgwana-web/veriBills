import "server-only";

import {
  MockDebiCheckProvider,
  MockEmailProvider,
  MockMeterVendor,
  MockPaymentGateway,
  MockSmsProvider,
  MockTokenVendor,
} from "./mock";
import type {
  DebiCheckProvider,
  EmailProvider,
  MeterVendor,
  PaymentGateway,
  SmsProvider,
  TokenVendor,
} from "./types";

/**
 * Provider registry.
 *
 * Each factory reads its provider from the environment and falls back to the
 * mock when the named provider has no implementation yet, so the platform
 * always boots. Real providers slot in here as they are built.
 */

export function getPaymentGateway(): PaymentGateway {
  switch (process.env.PAYMENT_GATEWAY_PROVIDER) {
    // case "peach": return new PeachPaymentsGateway(...)
    // case "ozow": return new OzowGateway(...)
    default:
      return new MockPaymentGateway();
  }
}

export function getTokenVendor(): TokenVendor {
  switch (process.env.TOKEN_VENDOR_PROVIDER) {
    // case "eskom": return new EskomTokenVendor(...)
    default:
      return new MockTokenVendor();
  }
}

export function getDebiCheckProvider(): DebiCheckProvider {
  switch (process.env.DEBICHECK_PROVIDER) {
    // case "netcash": return new NetcashDebiCheck(...)
    default:
      return new MockDebiCheckProvider();
  }
}

export function getEmailProvider(): EmailProvider {
  switch (process.env.EMAIL_PROVIDER) {
    // case "sendgrid": return new SendGridProvider(...)
    default:
      return new MockEmailProvider();
  }
}

export function getSmsProvider(): SmsProvider {
  switch (process.env.SMS_PROVIDER) {
    // case "clickatell": return new ClickatellProvider(...)
    default:
      return new MockSmsProvider();
  }
}

export function getMeterVendor(): MeterVendor {
  switch (process.env.METER_VENDOR_PROVIDER) {
    // case "landis_gyr": return new LandisGyrVendor(...)
    default:
      return new MockMeterVendor();
  }
}

/** Which providers are running against mocks, for the admin health screen. */
export function integrationStatus() {
  const entries = [
    ["Payment gateway", process.env.PAYMENT_GATEWAY_PROVIDER, getPaymentGateway().name],
    ["Token vendor", process.env.TOKEN_VENDOR_PROVIDER, getTokenVendor().name],
    ["DebiCheck", process.env.DEBICHECK_PROVIDER, getDebiCheckProvider().name],
    ["Email", process.env.EMAIL_PROVIDER, getEmailProvider().name],
    ["SMS", process.env.SMS_PROVIDER, getSmsProvider().name],
    ["Meter vendor", process.env.METER_VENDOR_PROVIDER, getMeterVendor().name],
  ] as const;

  return entries.map(([label, configured, active]) => ({
    label,
    configured: configured ?? "unset",
    active,
    isMock: active === "mock",
  }));
}

export * from "./types";
