"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSystemAdmin } from "@/lib/auth/session";
import { getMeterVendor } from "@/lib/integrations";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

/**
 * Poll the AMI vendor for fresh reads on every active meter.
 *
 * Readings are inserted through the normal path so consumption derivation and
 * anomaly detection run exactly as they do for a live push.
 */
export async function pollMeters(): Promise<ActionState> {
  await requireSystemAdmin();

  const admin = createAdminClient();

  const { data: meters } = await admin
    .from("meters")
    .select("id, org_id, meter_number, last_reading")
    .eq("is_active", true)
    .not("vendor", "is", null);

  if (!meters || meters.length === 0) {
    return { status: "error", message: "No meters are configured for polling." };
  }

  const result = await getMeterVendor().poll(meters.map((m) => m.meter_number));

  if (!result.ok) {
    return { status: "error", message: result.error };
  }

  const byNumber = new Map(meters.map((m) => [m.meter_number, m]));
  let inserted = 0;
  let skipped = 0;

  for (const poll of result.data) {
    const meter = byNumber.get(poll.meterNumber);
    if (!meter) continue;

    // A read below the last one means a rollover or a replaced meter; leave
    // those for a human rather than inventing a negative consumption.
    if (meter.last_reading !== null && poll.reading < Number(meter.last_reading)) {
      skipped++;
      continue;
    }

    const { error } = await admin.from("meter_readings").insert({
      meter_id: meter.id,
      org_id: meter.org_id,
      reading: poll.reading,
      read_at: poll.readAt,
      source: "ami_poll",
      is_estimate: poll.isEstimate,
    });

    if (!error) {
      inserted++;
      await admin.rpc("refresh_usage_baseline", { p_meter: meter.id, p_days: 30 });
    }
  }

  revalidatePath("/admin/meters");

  return {
    status: "success",
    message: `Polled ${result.data.length} meters, stored ${inserted} reading${inserted === 1 ? "" : "s"}${
      skipped ? `, skipped ${skipped} below the previous read` : ""
    }.`,
  };
}

/** Record a health probe for each configured component. */
export async function runHealthCheck(): Promise<ActionState> {
  await requireSystemAdmin();

  const admin = createAdminClient();
  const checks: Array<{ component: string; ok: boolean; latency: number; detail: string }> = [];

  // Database round trip.
  const dbStart = Date.now();
  const { error: dbError } = await admin.from("organisations").select("id").limit(1);
  checks.push({
    component: "database",
    ok: !dbError,
    latency: Date.now() - dbStart,
    detail: dbError?.message ?? "Query succeeded",
  });

  // Auth service.
  const authStart = Date.now();
  const { error: authError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 });
  checks.push({
    component: "auth",
    ok: !authError,
    latency: Date.now() - authStart,
    detail: authError?.message ?? "Auth reachable",
  });

  // Meter vendor.
  const meterStart = Date.now();
  const meterResult = await getMeterVendor().poll(["health-probe"]);
  checks.push({
    component: "meter_vendor",
    ok: meterResult.ok,
    latency: Date.now() - meterStart,
    detail: meterResult.ok ? `Provider: ${getMeterVendor().name}` : meterResult.error,
  });

  await admin.from("system_health_checks").insert(
    checks.map((check) => ({
      component: check.component,
      status: check.ok ? ("healthy" as const) : ("down" as const),
      latency_ms: check.latency,
      detail: check.detail,
    })),
  );

  revalidatePath("/admin/health");

  const failing = checks.filter((c) => !c.ok);
  return {
    status: failing.length === 0 ? "success" : "error",
    message:
      failing.length === 0
        ? `All ${checks.length} components healthy.`
        : `${failing.length} component${failing.length === 1 ? "" : "s"} unhealthy: ${failing.map((f) => f.component).join(", ")}.`,
  };
}
