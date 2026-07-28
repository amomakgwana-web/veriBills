import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPaymentGateway } from "@/lib/integrations";
import { capturePayment } from "@/lib/actions/payments";

/**
 * Where the issuer returns the cardholder after a 3-D Secure challenge.
 *
 * The payment is resolved by its gateway reference rather than anything the
 * browser supplies about identity, and the outcome is confirmed with the
 * gateway rather than trusted from the POST body.
 */
export async function POST(request: Request) {
  const form = await request.formData();
  const gatewayReference = String(form.get("ref") ?? "");
  const outcome = String(form.get("outcome") ?? "");
  const rawReturn = String(form.get("return") ?? "/tenant/billing");

  // Only ever redirect to a path on this origin.
  const returnPath = rawReturn.startsWith("/") ? rawReturn : "/tenant/billing";

  if (!gatewayReference) {
    return redirectWith(request, returnPath, "error", "Missing payment reference");
  }

  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select("id, status")
    .eq("gateway_reference", gatewayReference)
    .maybeSingle();

  if (!payment) {
    return redirectWith(request, returnPath, "error", "Payment not found");
  }

  // Already resolved: don't double-capture on a refresh or replayed POST.
  if (payment.status !== "requires_3ds" && payment.status !== "initiated") {
    return redirectWith(request, returnPath, "info", "This payment was already processed");
  }

  const result = await getPaymentGateway().complete3ds(gatewayReference, { outcome });

  if (!result.ok || result.data.status === "failed") {
    const reason = result.ok ? result.data.failureReason : result.error;

    await admin
      .from("payments")
      .update({
        status: "failed",
        three_ds_status: "failed",
        three_ds_completed_at: new Date().toISOString(),
        failure_code: result.ok ? result.data.failureCode : result.code,
        failure_reason: reason,
      })
      .eq("id", payment.id);

    return redirectWith(request, returnPath, "error", reason ?? "Authentication failed");
  }

  const captured = await capturePayment(
    payment.id,
    gatewayReference,
    result.data.threeDs?.version ?? "2.2.0",
  );

  return redirectWith(
    request,
    returnPath,
    captured.status === "success" ? "success" : "error",
    captured.message ?? "",
  );
}

function redirectWith(request: Request, path: string, status: string, message: string) {
  const url = new URL(path, request.url);
  url.searchParams.set("payment", status);
  if (message) url.searchParams.set("message", message);
  return NextResponse.redirect(url, { status: 303 });
}
