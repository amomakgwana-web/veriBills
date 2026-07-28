"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { getPaymentGateway, getTokenVendor } from "@/lib/integrations";
import { fromCents } from "@/lib/domain/money";
import { costForUnits, unitsForAmount } from "@/lib/domain/tariff";
import { sendElectricityToken } from "@/lib/actions/notifications";

export type ElectricityState = {
  status: "idle" | "success" | "error";
  message?: string;
  token?: string;
  units?: number;
};

/**
 * Buy prepaid electricity.
 *
 * Order of operations matters: take the money first, then vend. If vending
 * fails after a successful charge the purchase is marked failed and flagged for
 * refund rather than silently swallowing the payment.
 */
export async function buyElectricity(
  _prev: ElectricityState,
  formData: FormData,
): Promise<ElectricityState> {
  const session = await requireSession();

  const meterId = String(formData.get("meter_id") ?? "");
  const rawAmount = Number(formData.get("amount") ?? 0);

  if (!meterId) return { status: "error", message: "Select a meter." };
  if (!Number.isFinite(rawAmount) || rawAmount < 10) {
    return { status: "error", message: "Minimum purchase is R10." };
  }

  if (!hasServiceRole()) {
    return {
      status: "error",
      message: "Purchases are unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured.",
    };
  }

  const amountCents = Math.round(rawAmount * 100);
  const supabase = await createClient();

  // RLS restricts this to meters on a unit the caller leases.
  const { data: meter } = await supabase
    .from("meters")
    .select("id, org_id, unit_id, meter_number, tariff_id, type")
    .eq("id", meterId)
    .maybeSingle();

  if (!meter?.unit_id) {
    return { status: "error", message: "That meter is not linked to your unit." };
  }

  if (!meter.tariff_id) {
    return { status: "error", message: "No tariff is configured for this meter. Contact the estate." };
  }

  const { data: tariff } = await supabase
    .from("tariffs")
    .select("fixed_charge, vat_rate, markup_percent, tariff_blocks(sequence, block_from_units, block_to_units, rate_per_unit)")
    .eq("id", meter.tariff_id)
    .maybeSingle();

  if (!tariff) return { status: "error", message: "Tariff not found." };

  const blocks = tariff.tariff_blocks ?? [];
  const units = unitsForAmount(tariff, blocks, rawAmount);

  if (units <= 0) {
    return {
      status: "error",
      message: "That amount only covers the fixed charges. Increase the amount to buy units.",
    };
  }

  const cost = costForUnits(tariff, blocks, units);
  const reference = `ELE-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;

  const { data: purchase, error: purchaseError } = await supabase
    .from("electricity_purchases")
    .insert({
      org_id: meter.org_id,
      unit_id: meter.unit_id,
      meter_id: meter.id,
      profile_id: session.userId,
      reference,
      status: "pending",
      gross_amount: rawAmount,
      vat_amount: cost.vat,
      units_kwh: units,
      rate_per_kwh: units > 0 ? Number((rawAmount / units).toFixed(6)) : 0,
      tariff_id: meter.tariff_id,
    })
    .select("id")
    .single();

  if (purchaseError || !purchase) {
    return { status: "error", message: purchaseError?.message ?? "Could not start the purchase." };
  }

  const admin = createAdminClient();

  // 1. Take the money.
  const charge = await getPaymentGateway().charge({
    reference,
    amountCents,
    currency: "ZAR",
    description: `Prepaid electricity for meter ${meter.meter_number}`,
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/tenant/electricity`,
    customer: { id: session.userId, email: session.email },
  });

  if (!charge.ok || charge.data.status === "failed") {
    const reason = charge.ok ? charge.data.failureReason : charge.error;
    await admin
      .from("electricity_purchases")
      .update({ status: "failed", failure_reason: reason })
      .eq("id", purchase.id);
    return { status: "error", message: reason ?? "The payment was declined." };
  }

  const { data: payment } = await admin
    .from("payments")
    .insert({
      org_id: meter.org_id,
      profile_id: session.userId,
      reference,
      method: "card",
      status: "captured",
      amount: fromCents(amountCents),
      intent_channel: "electricity",
      gateway: getPaymentGateway().name,
      gateway_reference: charge.data.gatewayReference,
      captured_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  await admin
    .from("electricity_purchases")
    .update({ status: "paid", payment_id: payment?.id ?? null })
    .eq("id", purchase.id);

  // 2. Vend the token.
  const vend = await getTokenVendor().issueToken({
    meterNumber: meter.meter_number,
    amountCents,
    units,
    reference,
  });

  if (!vend.ok) {
    // Money taken but no token: mark it for the finance team to refund.
    await admin
      .from("electricity_purchases")
      .update({ status: "failed", failure_reason: `Vending failed: ${vend.error}` })
      .eq("id", purchase.id);

    return {
      status: "error",
      message:
        "Your payment went through but the token could not be issued. The estate has been notified and will refund or reissue.",
    };
  }

  const debtRecovered = fromCents(vend.data.debtRecoveredCents);

  await admin
    .from("electricity_purchases")
    .update({
      status: "token_issued",
      token: vend.data.token,
      token_type: vend.data.tokenType,
      vendor_reference: vend.data.vendorReference,
      units_kwh: vend.data.units,
      debt_recovered: debtRecovered,
      issued_at: new Date().toISOString(),
    })
    .eq("id", purchase.id);

  await sendElectricityToken(purchase.id);

  revalidatePath("/tenant/electricity");

  return {
    status: "success",
    message: `Token issued for ${vend.data.units.toFixed(2)} kWh.`,
    token: vend.data.token,
    units: vend.data.units,
  };
}
