"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { getPaymentGateway } from "@/lib/integrations";
import { toCents, fromCents } from "@/lib/domain/money";
import { sendPaymentReceipt } from "@/lib/actions/notifications";
import type { Database } from "@/lib/supabase/types";

type ChargeType = Database["public"]["Enums"]["charge_type"];

export type PaymentActionState = {
  status: "idle" | "success" | "error" | "requires_3ds";
  message?: string;
  redirectUrl?: string;
  paymentId?: string;
};

/** Approval threshold above which a payment is held for a second pair of eyes. */
async function requiresApproval(orgId: string, amountCents: number): Promise<number | null> {
  const admin = createAdminClient();

  const { data } = await admin
    .from("approval_policies")
    .select("amount_threshold, required_approvals, is_active")
    .eq("org_id", orgId)
    .eq("type", "large_payment")
    .maybeSingle();

  if (!data?.is_active) return null;

  const threshold = toCents(data.amount_threshold);
  if (threshold > 0 && amountCents < threshold) return null;

  return data.required_approvals ?? 1;
}

/**
 * Take a payment against a tenant account.
 *
 * The row is created under the caller's own session (so RLS proves they own the
 * account), then the gateway is called and settlement is applied with the
 * service role, because allocating across invoices and writing the ledger is
 * deliberately not something a browser session may do.
 */
export async function payAccount(
  _prev: PaymentActionState,
  formData: FormData,
): Promise<PaymentActionState> {
  const session = await requireSession();

  const accountId = String(formData.get("account_id") ?? "");
  const rawAmount = Number(formData.get("amount") ?? 0);
  const channel = (String(formData.get("channel") ?? "rent") || "rent") as ChargeType;

  if (!accountId) return { status: "error", message: "Select an account to pay." };
  if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
    return { status: "error", message: "Enter an amount greater than zero." };
  }

  const amountCents = Math.round(rawAmount * 100);

  if (!hasServiceRole()) {
    return {
      status: "error",
      message:
        "Payments are unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured on the server.",
    };
  }

  const supabase = await createClient();

  // RLS guarantees this only resolves for an account the caller is a tenant on.
  const { data: account, error: accountError } = await supabase
    .from("tenant_accounts")
    .select("id, org_id, account_number, balance")
    .eq("id", accountId)
    .maybeSingle();

  if (accountError || !account) {
    return { status: "error", message: "That account is not available on your profile." };
  }

  const reference = `PAY-${Date.now()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  const approvals = await requiresApproval(account.org_id, amountCents);

  const { data: payment, error: insertError } = await supabase
    .from("payments")
    .insert({
      org_id: account.org_id,
      account_id: account.id,
      profile_id: session.userId,
      reference,
      method: "card",
      status: "initiated",
      amount: fromCents(amountCents),
      intent_channel: channel,
      gateway: getPaymentGateway().name,
      requires_approval: approvals !== null,
    })
    .select("id")
    .single();

  if (insertError || !payment) {
    return { status: "error", message: insertError?.message ?? "Could not start the payment." };
  }

  const admin = createAdminClient();
  const gateway = getPaymentGateway();

  const result = await gateway.charge({
    reference,
    amountCents,
    currency: "ZAR",
    description: `veriBills ${channel} payment for ${account.account_number}`,
    returnUrl: `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/payments/3ds/return`,
    customer: { id: session.userId, email: session.email },
  });

  if (!result.ok) {
    await admin
      .from("payments")
      .update({ status: "failed", failure_reason: result.error, failure_code: result.code })
      .eq("id", payment.id);

    return { status: "error", message: result.error };
  }

  const charge = result.data;

  if (charge.status === "requires_3ds") {
    await admin
      .from("payments")
      .update({
        status: "requires_3ds",
        gateway_reference: charge.gatewayReference,
        three_ds_required: true,
        three_ds_status: "challenged",
        three_ds_version: charge.threeDs?.version,
        three_ds_redirect_url: charge.redirectUrl,
      })
      .eq("id", payment.id);

    return {
      status: "requires_3ds",
      message: "Your bank needs to verify this payment.",
      redirectUrl: charge.redirectUrl,
      paymentId: payment.id,
    };
  }

  if (charge.status === "failed") {
    await admin
      .from("payments")
      .update({
        status: "failed",
        gateway_reference: charge.gatewayReference,
        failure_code: charge.failureCode,
        failure_reason: charge.failureReason,
      })
      .eq("id", payment.id);

    return { status: "error", message: charge.failureReason ?? "The payment was declined." };
  }

  const settled = await capturePayment(payment.id, charge.gatewayReference, charge.threeDs?.version);

  revalidatePath("/tenant/billing");
  revalidatePath("/tenant");

  return settled;
}

/**
 * Move an authorised payment to captured and settle it against open invoices.
 * Shared by the direct path and the 3DS return handler.
 */
export async function capturePayment(
  paymentId: string,
  gatewayReference: string,
  threeDsVersion?: string,
): Promise<PaymentActionState> {
  const admin = createAdminClient();
  const now = new Date().toISOString();

  const { data: payment, error } = await admin
    .from("payments")
    .update({
      status: "captured",
      gateway_reference: gatewayReference,
      three_ds_version: threeDsVersion,
      three_ds_status: threeDsVersion ? "authenticated" : undefined,
      three_ds_completed_at: threeDsVersion ? now : undefined,
      authorised_at: now,
      captured_at: now,
    })
    .eq("id", paymentId)
    .select("id, requires_approval, amount, account_id, org_id, reference")
    .single();

  if (error || !payment) {
    return { status: "error", message: error?.message ?? "Could not capture the payment." };
  }

  // Payments over the approval threshold are captured but deliberately not
  // allocated until an approver releases them.
  if (payment.requires_approval) {
    await admin.from("approvals").insert({
      org_id: payment.org_id,
      type: "large_payment",
      title: `Large payment ${payment.reference}`,
      description: "Payment exceeds the configured approval threshold.",
      subject_table: "payments",
      subject_id: payment.id,
      amount: payment.amount,
    });

    return {
      status: "success",
      message:
        "Payment received. It is held for approval before being allocated to your account.",
      paymentId,
    };
  }

  const { error: settleError } = await admin.rpc("settle_payment", { p_payment: paymentId });

  if (settleError) {
    return { status: "error", message: `Payment captured but not allocated: ${settleError.message}` };
  }

  await sendPaymentReceipt(paymentId);

  return { status: "success", message: "Payment successful. Your receipt is on its way.", paymentId };
}
