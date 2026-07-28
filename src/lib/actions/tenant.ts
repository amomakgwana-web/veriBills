"use server";

import { randomInt, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { splitInstalments, fromCents, toCents, formatMoney } from "@/lib/domain/money";
import type { Database } from "@/lib/supabase/types";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

type Priority = Database["public"]["Enums"]["maintenance_priority"];
type AccessCodeType = Database["public"]["Enums"]["access_code_type"];

/**
 * Tenant asks for a payment plan on their own account. Unlike
 * `proposePaymentPlan` (estate-initiated), this doesn't activate anything —
 * it lands as a `requested` plan plus a `payment_plan` approval, so an
 * owner/admin/manager has to vet it first. See `decideApproval` for what
 * happens once they do.
 */
export async function requestPaymentPlan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const accountId = String(formData.get("account_id") ?? "");
  const instalments = Number(formData.get("instalment_count") ?? 0);
  const depositAmount = Number(formData.get("deposit_amount") ?? 0);
  const note = String(formData.get("note") ?? "").trim();

  if (!Number.isFinite(instalments) || instalments < 1 || instalments > 36) {
    return { status: "error", message: "Choose between 1 and 36 instalments." };
  }
  if (!Number.isFinite(depositAmount) || depositAmount < 0) {
    return { status: "error", message: "Deposit cannot be negative." };
  }

  const session = await requireSession();
  const unit = session.units.find((u) => u.accountId === accountId);
  if (!unit) return { status: "error", message: "That account is not on your profile." };

  const admin = createAdminClient();

  const { data: existing } = await admin
    .from("payment_plans")
    .select("id")
    .eq("account_id", accountId)
    .in("status", ["requested", "proposed", "awaiting_acceptance", "active"])
    .maybeSingle();

  if (existing) {
    return { status: "error", message: "You already have a plan request or arrangement in progress." };
  }

  const { data: account } = await admin
    .from("tenant_accounts")
    .select("id, balance")
    .eq("id", accountId)
    .maybeSingle();

  if (!account) return { status: "error", message: "Account not found." };

  const arrearsCents = toCents(account.balance) - Math.round(depositAmount * 100);
  if (arrearsCents <= 0) {
    return { status: "error", message: "Your balance does not need a payment plan." };
  }

  const amounts = splitInstalments(arrearsCents, instalments);

  const { data: reference } = await admin.rpc("next_sequence_number", {
    p_org: unit.orgId,
    p_kind: "payment_plan",
    p_prefix: "PP",
  });

  const firstDue = new Date();
  firstDue.setMonth(firstDue.getMonth() + 1, 1);

  const { data: plan, error } = await admin
    .from("payment_plans")
    .insert({
      org_id: unit.orgId,
      account_id: accountId,
      reference: reference ?? `PP-${randomUUID().slice(0, 8).toUpperCase()}`,
      status: "requested",
      arrears_amount: fromCents(arrearsCents),
      deposit_amount: depositAmount,
      instalment_amount: fromCents(amounts[0]),
      instalment_count: instalments,
      first_due_date: firstDue.toISOString().slice(0, 10),
      notes: note || null,
    })
    .select("id, reference")
    .single();

  if (error || !plan) {
    return { status: "error", message: error?.message ?? "Could not submit your request." };
  }

  await admin.from("payment_plan_instalments").insert(
    amounts.map((amountCents, index) => {
      const due = new Date(firstDue);
      due.setMonth(due.getMonth() + index);
      return {
        plan_id: plan.id,
        sequence: index + 1,
        due_date: due.toISOString().slice(0, 10),
        amount: fromCents(amountCents),
      };
    }),
  );

  await admin.from("approvals").insert({
    org_id: unit.orgId,
    type: "payment_plan",
    title: `Payment plan request — ${plan.reference}`,
    description:
      `${session.fullName ?? session.email} (${unit.unitNumber}) asked for ${instalments} ` +
      `instalments of ${formatMoney(fromCents(amounts[0]))}` +
      (depositAmount > 0 ? ` after a ${formatMoney(depositAmount)} deposit.` : ".") +
      (note ? ` Note: ${note}` : ""),
    subject_table: "payment_plans",
    subject_id: plan.id,
    amount: fromCents(arrearsCents),
    requested_by: session.userId,
  });

  revalidatePath("/tenant/billing");
  return { status: "success", message: `Request ${plan.reference} sent for approval.` };
}

/** Accept a payment arrangement the estate proposed. */
export async function acceptPaymentPlan(planId: string): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("payment_plans")
    .update({
      status: "active",
      accepted_at: new Date().toISOString(),
      accepted_by: session.userId,
    })
    .eq("id", planId);

  if (error) return { status: "error", message: error.message };

  const admin = createAdminClient();
  const { data: plan } = await admin
    .from("payment_plans")
    .select("account_id")
    .eq("id", planId)
    .maybeSingle();

  if (plan) {
    await admin
      .from("tenant_accounts")
      .update({ is_on_payment_plan: true })
      .eq("id", plan.account_id);
  }

  revalidatePath("/tenant/billing");
  return { status: "success", message: "Arrangement accepted." };
}

/** Log a maintenance request against the caller's own unit. */
export async function logMaintenance(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const unitId = String(formData.get("unit_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category = String(formData.get("category") ?? "general");
  const priority = String(formData.get("priority") ?? "normal") as Priority;
  const locationDetail = String(formData.get("location_detail") ?? "").trim();
  const permission = formData.get("permission_to_enter") === "on";

  if (!title || !description) {
    return { status: "error", message: "Give the request a title and a description." };
  }

  const unit = session.units.find((u) => u.unitId === unitId);
  if (!unit) return { status: "error", message: "That unit is not on your profile." };

  const supabase = await createClient();
  const admin = createAdminClient();

  // Reference numbers come from the org-scoped sequence, which is service-role only.
  const { data: reference } = await admin.rpc("next_sequence_number", {
    p_org: unit.orgId,
    p_kind: "maintenance",
    p_prefix: "MNT",
  });

  const { error } = await supabase.from("maintenance_requests").insert({
    org_id: unit.orgId,
    property_id: unit.propertyId,
    unit_id: unit.unitId,
    lease_id: unit.leaseId,
    reported_by: session.userId,
    reference: reference ?? `MNT-${randomUUID().slice(0, 8).toUpperCase()}`,
    category,
    priority,
    status: "logged",
    title,
    description,
    location_detail: locationDetail || null,
    permission_to_enter: permission,
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/tenant/maintenance");
  return { status: "success", message: "Request logged. You will get updates by email." };
}

/** Generate a visitor gate code. */
export async function createAccessCode(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const unitId = String(formData.get("unit_id") ?? "");
  const visitorName = String(formData.get("visitor_name") ?? "").trim();
  const visitorPhone = String(formData.get("visitor_phone") ?? "").trim();
  const vehicle = String(formData.get("vehicle_registration") ?? "").trim();
  const type = String(formData.get("type") ?? "visitor") as AccessCodeType;
  const hours = Number(formData.get("valid_hours") ?? 6);
  const maxUses = Number(formData.get("max_uses") ?? 1);

  const unit = session.units.find((u) => u.unitId === unitId);
  if (!unit) return { status: "error", message: "That unit is not on your profile." };
  if (!visitorName) return { status: "error", message: "Who is the code for?" };
  if (!Number.isFinite(hours) || hours < 1 || hours > 720) {
    return { status: "error", message: "Validity must be between 1 and 720 hours." };
  }
  if (!Number.isFinite(maxUses) || maxUses < 1 || maxUses > 50) {
    return { status: "error", message: "Uses must be between 1 and 50." };
  }

  const supabase = await createClient();

  // Retry on collision: the partial unique index only covers live codes, so a
  // clash is possible but rare.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = String(randomInt(100000, 999999));

    const { error } = await supabase.from("access_codes").insert({
      org_id: unit.orgId,
      property_id: unit.propertyId,
      unit_id: unit.unitId,
      issued_by: session.userId,
      code,
      type,
      visitor_name: visitorName,
      visitor_phone: visitorPhone || null,
      vehicle_registration: vehicle || null,
      valid_until: new Date(Date.now() + hours * 3600_000).toISOString(),
      max_uses: maxUses,
    });

    if (!error) {
      revalidatePath("/tenant/access");
      return { status: "success", message: `Code ${code} created for ${visitorName}.` };
    }

    if (!error.message.includes("access_codes_live_unique")) {
      return { status: "error", message: error.message };
    }
  }

  return { status: "error", message: "Could not allocate a free code. Please try again." };
}

export async function revokeAccessCode(codeId: string): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("access_codes")
    .update({
      status: "revoked",
      revoked_at: new Date().toISOString(),
      revoked_by: session.userId,
    })
    .eq("id", codeId);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/tenant/access");
  return { status: "success", message: "Code revoked." };
}

/** Update the caller's own profile. */
export async function updateProfile(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();

  const dateOfBirth = String(formData.get("date_of_birth") ?? "").trim();

  const { error } = await supabase
    .from("profiles")
    .update({
      full_name: String(formData.get("full_name") ?? "").trim() || null,
      preferred_name: String(formData.get("preferred_name") ?? "").trim() || null,
      phone: String(formData.get("phone") ?? "").trim() || null,
      alt_phone: String(formData.get("alt_phone") ?? "").trim() || null,
      id_number: String(formData.get("id_number") ?? "").trim() || null,
      id_type: String(formData.get("id_type") ?? "sa_id"),
      date_of_birth: dateOfBirth || null,
      postal_address: String(formData.get("postal_address") ?? "").trim() || null,
      emergency_contact_name:
        String(formData.get("emergency_contact_name") ?? "").trim() || null,
      emergency_contact_phone:
        String(formData.get("emergency_contact_phone") ?? "").trim() || null,
      notify_email: formData.get("notify_email") === "on",
      notify_sms: formData.get("notify_sms") === "on",
      marketing_opt_in: formData.get("marketing_opt_in") === "on",
    })
    .eq("id", session.userId);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/tenant/profile");
  return { status: "success", message: "Profile updated." };
}

/** Book a shared facility, refusing when the tenant is not in good standing. */
export async function bookFacility(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const facilityId = String(formData.get("facility_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");
  const startsAt = String(formData.get("starts_at") ?? "");
  const minutes = Number(formData.get("minutes") ?? 60);
  const guests = Number(formData.get("guest_count") ?? 0);

  const unit = session.units.find((u) => u.unitId === unitId);
  if (!unit) return { status: "error", message: "That unit is not on your profile." };
  if (!startsAt) return { status: "error", message: "Pick a start time." };

  const start = new Date(startsAt);
  if (Number.isNaN(start.getTime())) return { status: "error", message: "Invalid start time." };
  if (start.getTime() < Date.now()) {
    return { status: "error", message: "Pick a time in the future." };
  }

  const supabase = await createClient();

  const { data: facility } = await supabase
    .from("facilities")
    .select("id, org_id, name, max_booking_minutes, booking_fee, requires_good_standing, capacity")
    .eq("id", facilityId)
    .maybeSingle();

  if (!facility) return { status: "error", message: "Facility not found." };

  if (minutes > facility.max_booking_minutes) {
    return {
      status: "error",
      message: `Bookings are capped at ${facility.max_booking_minutes} minutes.`,
    };
  }

  if (facility.requires_good_standing && Number(unit.balance ?? 0) > 0) {
    return {
      status: "error",
      message: "Settle your outstanding balance to book this facility.",
    };
  }

  const endsAt = new Date(start.getTime() + minutes * 60_000);

  // Refuse a booking that collides with a confirmed one on the same facility.
  const { data: clash } = await supabase
    .from("facility_bookings")
    .select("id")
    .eq("facility_id", facilityId)
    .in("status", ["requested", "confirmed"])
    .lt("starts_at", endsAt.toISOString())
    .gt("ends_at", start.toISOString())
    .limit(1);

  if (clash && clash.length > 0) {
    return { status: "error", message: "That slot is already taken. Choose another time." };
  }

  const { error } = await supabase.from("facility_bookings").insert({
    org_id: facility.org_id,
    facility_id: facilityId,
    profile_id: session.userId,
    unit_id: unitId,
    status: "requested",
    starts_at: start.toISOString(),
    ends_at: endsAt.toISOString(),
    guest_count: Number.isFinite(guests) ? guests : 0,
    fee_amount: facility.booking_fee,
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/tenant/facilities");
  return { status: "success", message: `Booked ${facility.name}.` };
}

/** Submit an application for a new unit, office or store. */
export async function submitApplication(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const orgId = String(formData.get("org_id") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");
  const unitId = String(formData.get("unit_id") ?? "");

  if (!orgId) return { status: "error", message: "Choose an estate to apply to." };

  const admin = createAdminClient();

  const { data: reference } = await admin.rpc("next_sequence_number", {
    p_org: orgId,
    p_kind: "application",
    p_prefix: "APP",
  });

  const income = Number(formData.get("monthly_income") ?? 0);
  const isCompany = formData.get("is_company") === "on";

  const supabase = await createClient();

  const { error } = await supabase.from("unit_applications").insert({
    org_id: orgId,
    property_id: propertyId || null,
    unit_id: unitId || null,
    applicant_id: session.userId,
    reference: reference ?? `APP-${randomUUID().slice(0, 8).toUpperCase()}`,
    status: "submitted",
    requested_type: String(formData.get("requested_type") ?? "apartment") as
      Database["public"]["Enums"]["unit_type"],
    desired_move_in: String(formData.get("desired_move_in") ?? "") || null,
    lease_term_months: Number(formData.get("lease_term_months") ?? 12) || null,
    monthly_income: Number.isFinite(income) && income > 0 ? income : null,
    employer: String(formData.get("employer") ?? "").trim() || null,
    employment_type: String(formData.get("employment_type") ?? "") || null,
    occupants: Number(formData.get("occupants") ?? 1) || null,
    has_pets: formData.get("has_pets") === "on",
    pet_detail: String(formData.get("pet_detail") ?? "").trim() || null,
    is_company: isCompany,
    company_name: isCompany ? String(formData.get("company_name") ?? "").trim() || null : null,
    company_reg_no: isCompany ? String(formData.get("company_reg_no") ?? "").trim() || null : null,
    trading_type: isCompany ? String(formData.get("trading_type") ?? "").trim() || null : null,
    motivation: String(formData.get("motivation") ?? "").trim() || null,
    credit_check_status: "not_run",
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/tenant/applications");
  return { status: "success", message: "Application submitted. The estate will be in touch." };
}

/** Tenant-submitted meter reading, for estates without smart meters. */
export async function submitMeterReading(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await requireSession();

  const meterId = String(formData.get("meter_id") ?? "");
  const reading = Number(formData.get("reading") ?? 0);

  if (!Number.isFinite(reading) || reading < 0) {
    return { status: "error", message: "Enter a valid reading." };
  }

  const supabase = await createClient();

  const { data: meter } = await supabase
    .from("meters")
    .select("id, org_id, last_reading")
    .eq("id", meterId)
    .maybeSingle();

  if (!meter) return { status: "error", message: "Meter not found." };

  if (meter.last_reading !== null && reading < Number(meter.last_reading)) {
    return {
      status: "error",
      message: `Reading is below the previous one (${meter.last_reading}). Check the digits and try again.`,
    };
  }

  const { error } = await supabase.from("meter_readings").insert({
    meter_id: meterId,
    org_id: meter.org_id,
    reading,
    source: "tenant_submitted",
    read_by: session.userId,
  });

  if (error) return { status: "error", message: error.message };

  revalidatePath("/tenant/electricity");
  return { status: "success", message: "Reading submitted." };
}
