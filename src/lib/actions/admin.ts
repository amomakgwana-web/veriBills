"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireSystemAdmin } from "@/lib/auth/session";
import { getMeterVendor } from "@/lib/integrations";
import type { Database } from "@/lib/supabase/types";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

const TARIFF_UTILITIES = ["water", "electricity_prepaid", "electricity_conventional"] as const;

type TariffBlockInput = { from: number; to: number | null; rate: number };

/** Blocks travel from the client as JSON built by the row editor. */
function parseBlocks(raw: string): TariffBlockInput[] | null {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) return null;

    const blocks = parsed.map((b) => ({
      from: Number(b.from),
      to: b.to === null || b.to === "" || b.to === undefined ? null : Number(b.to),
      rate: Number(b.rate),
    }));

    if (blocks.some((b) => !Number.isFinite(b.from) || !Number.isFinite(b.rate) || b.rate < 0)) {
      return null;
    }

    return blocks;
  } catch {
    return null;
  }
}

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

// ---------------------------------------------------------------------------
// Tariffs (water and electricity stepped block rates)
// ---------------------------------------------------------------------------

export async function createTariff(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSystemAdmin();

  const orgId = String(formData.get("org_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const utility = String(formData.get("utility") ?? "");
  const fixedCharge = Number(formData.get("fixed_charge") ?? 0);
  const vatRate = Number(formData.get("vat_rate") ?? 15) / 100;
  const markupPercent = Number(formData.get("markup_percent") ?? 0);
  const effectiveFrom = String(formData.get("effective_from") ?? "");
  const blocks = parseBlocks(String(formData.get("blocks") ?? "[]"));

  if (!orgId || !name) return { status: "error", message: "Give the tariff a name and organisation." };
  if (!TARIFF_UTILITIES.includes(utility as (typeof TARIFF_UTILITIES)[number])) {
    return { status: "error", message: "Choose a utility." };
  }
  if (!blocks) return { status: "error", message: "Add at least one valid rate block." };

  const admin = createAdminClient();

  const { data: tariff, error } = await admin
    .from("tariffs")
    .insert({
      org_id: orgId,
      name,
      utility: utility as Database["public"]["Enums"]["meter_type"],
      fixed_charge: fixedCharge,
      vat_rate: vatRate,
      markup_percent: markupPercent,
      effective_from: effectiveFrom || new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (error || !tariff) {
    return { status: "error", message: error?.message ?? "Could not create the tariff." };
  }

  const { error: blocksError } = await admin.from("tariff_blocks").insert(
    blocks.map((b, i) => ({
      tariff_id: tariff.id,
      sequence: i + 1,
      block_from_units: b.from,
      block_to_units: b.to,
      rate_per_unit: b.rate,
    })),
  );

  if (blocksError) {
    // Don't leave a blockless tariff behind for calculate_tariff_cost to trip over.
    await admin.from("tariffs").delete().eq("id", tariff.id);
    return { status: "error", message: blocksError.message };
  }

  revalidatePath("/admin/tariffs");
  revalidatePath("/admin/units");
  return { status: "success", message: `Created ${name}.` };
}

export async function replaceTariffBlocks(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireSystemAdmin();

  const tariffId = String(formData.get("tariff_id") ?? "");
  const blocks = parseBlocks(String(formData.get("blocks") ?? "[]"));

  if (!tariffId) return { status: "error", message: "Missing tariff." };
  if (!blocks) return { status: "error", message: "Add at least one valid rate block." };

  const admin = createAdminClient();

  const { error: deleteError } = await admin.from("tariff_blocks").delete().eq("tariff_id", tariffId);
  if (deleteError) return { status: "error", message: deleteError.message };

  const { error: insertError } = await admin.from("tariff_blocks").insert(
    blocks.map((b, i) => ({
      tariff_id: tariffId,
      sequence: i + 1,
      block_from_units: b.from,
      block_to_units: b.to,
      rate_per_unit: b.rate,
    })),
  );

  if (insertError) return { status: "error", message: insertError.message };

  revalidatePath("/admin/tariffs");
  revalidatePath("/admin/units");
  return { status: "success", message: "Rate blocks updated." };
}

export async function setTariffActive(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireSystemAdmin();

  const tariffId = String(formData.get("tariff_id") ?? "");
  const isActive = formData.get("is_active") === "true";

  if (!tariffId) return { status: "error", message: "Missing tariff." };

  const admin = createAdminClient();
  const { error } = await admin.from("tariffs").update({ is_active: isActive }).eq("id", tariffId);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/admin/tariffs");
  revalidatePath("/admin/units");
  return {
    status: "success",
    message: isActive ? "Tariff activated." : "Tariff deactivated.",
  };
}
