"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireSession } from "@/lib/auth/session";
import { splitInstalments, fromCents, toCents, formatMoney } from "@/lib/domain/money";
import { dispatch, renderBrandedEmail } from "@/lib/actions/notifications";
import { escapeHtml } from "@/lib/html";
import { getDebiCheckProvider } from "@/lib/integrations";
import type { Database } from "@/lib/supabase/types";

export type ActionState = { status: "idle" | "success" | "error"; message?: string };

type OrgRole = Database["public"]["Enums"]["org_role"];

/** Confirm the caller holds one of `roles` in `orgId`, or throw. */
async function assertRole(orgId: string, roles: OrgRole[]) {
  const session = await requireSession();

  if (session.isSystemAdmin) return session;

  const membership = session.memberships.find((m) => m.orgId === orgId);
  if (!membership || (!roles.includes(membership.role) && membership.role !== "owner")) {
    throw new Error("You do not have permission to do that.");
  }

  return session;
}

// ---------------------------------------------------------------------------
// Billing
// ---------------------------------------------------------------------------

export async function runBillingCycle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const periodStart = String(formData.get("period_start") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");

  if (!orgId || !periodStart) {
    return { status: "error", message: "Choose a billing period." };
  }

  try {
    const session = await assertRole(orgId, ["admin", "finance"]);

    const start = new Date(`${periodStart}-01T00:00:00Z`);
    if (Number.isNaN(start.getTime())) {
      return { status: "error", message: "Invalid period." };
    }

    const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0));
    const due = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 7));

    const admin = createAdminClient();

    const { data: runId, error } = await admin.rpc("run_billing", {
      p_org: orgId,
      p_period_start: start.toISOString().slice(0, 10),
      p_period_end: end.toISOString().slice(0, 10),
      p_due_date: due.toISOString().slice(0, 10),
      p_property: propertyId || undefined,
      p_run_by: session.userId,
    });

    if (error) return { status: "error", message: error.message };

    await admin.rpc("refresh_account_ageing", { p_org: orgId });

    const { data: run } = await admin
      .from("billing_runs")
      .select("invoices_created, total_billed")
      .eq("id", runId as string)
      .maybeSingle();

    revalidatePath("/estate/billing");

    return {
      status: "success",
      message: run
        ? `Billed ${run.invoices_created} account${run.invoices_created === 1 ? "" : "s"} for ${formatMoney(run.total_billed)}.`
        : "Billing run completed.",
    };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Payment plans
// ---------------------------------------------------------------------------

/**
 * Propose an arrangement for an account in arrears and email the tenant.
 * The tenant accepts it from their own portal.
 */
export async function proposePaymentPlan(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const accountId = String(formData.get("account_id") ?? "");
  const orgId = String(formData.get("org_id") ?? "");
  const instalments = Number(formData.get("instalment_count") ?? 0);
  const depositAmount = Number(formData.get("deposit_amount") ?? 0);

  if (!accountId || !orgId) return { status: "error", message: "Missing account." };
  if (!Number.isFinite(instalments) || instalments < 1 || instalments > 36) {
    return { status: "error", message: "Choose between 1 and 36 instalments." };
  }

  try {
    const session = await assertRole(orgId, ["admin", "finance", "manager"]);
    const admin = createAdminClient();

    const { data: account } = await admin
      .from("tenant_accounts")
      .select("id, balance, org_id, leases(lease_tenants(profile_id, is_primary, profiles(email, full_name, notify_email)))")
      .eq("id", accountId)
      .maybeSingle();

    if (!account) return { status: "error", message: "Account not found." };

    const arrearsCents = toCents(account.balance) - Math.round(depositAmount * 100);

    if (arrearsCents <= 0) {
      return { status: "error", message: "This account has nothing in arrears to spread." };
    }

    const amounts = splitInstalments(arrearsCents, instalments);

    const { data: reference } = await admin.rpc("next_sequence_number", {
      p_org: orgId,
      p_kind: "payment_plan",
      p_prefix: "PP",
    });

    const firstDue = new Date();
    firstDue.setMonth(firstDue.getMonth() + 1, 1);

    const { data: plan, error } = await admin
      .from("payment_plans")
      .insert({
        org_id: orgId,
        account_id: accountId,
        reference: reference ?? `PP-${randomUUID().slice(0, 8).toUpperCase()}`,
        status: "awaiting_acceptance",
        arrears_amount: fromCents(arrearsCents),
        deposit_amount: depositAmount,
        instalment_amount: fromCents(amounts[0]),
        instalment_count: instalments,
        first_due_date: firstDue.toISOString().slice(0, 10),
        proposed_by: session.userId,
      })
      .select("id, reference")
      .single();

    if (error || !plan) return { status: "error", message: error?.message ?? "Could not create plan." };

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

    // Tell the tenant it is waiting for them.
    const lease = account.leases as {
      lease_tenants: Array<{
        profile_id: string;
        is_primary: boolean;
        profiles: { email: string; full_name: string | null; notify_email: boolean } | null;
      }>;
    } | null;

    const primary =
      lease?.lease_tenants.find((t) => t.is_primary) ?? lease?.lease_tenants[0];

    if (primary?.profiles?.notify_email && primary.profiles.email) {
      const html = await renderBrandedEmail(
        orgId,
        "A payment arrangement for your account",
        `<p>Hi ${escapeHtml(primary.profiles.full_name ?? "there")},</p>
         <p>We have set up a proposed arrangement to help you settle the
         ${formatMoney(fromCents(arrearsCents))} outstanding on your account.</p>
         <p><strong>${formatMoney(fromCents(amounts[0]))} per month for ${instalments} months</strong>,
         alongside your normal monthly charges.</p>
         <p>Log in to your veriBills portal to accept it.</p>`,
      );

      await dispatch({
        orgId,
        channel: "email",
        to: primary.profiles.email,
        subject: "Payment arrangement proposal",
        body: html,
        templateKey: "payment_plan_proposal",
        profileId: primary.profile_id,
        accountId,
      });
    }

    revalidatePath("/estate/tenants");
    return { status: "success", message: `Proposed ${plan.reference} and emailed the tenant.` };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Approvals
// ---------------------------------------------------------------------------

export async function decideApproval(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const approvalId = String(formData.get("approval_id") ?? "");
  const decision = String(formData.get("decision") ?? "");
  const comment = String(formData.get("comment") ?? "").trim();
  const signature = String(formData.get("signature_name") ?? "").trim();

  if (decision !== "approved" && decision !== "rejected") {
    return { status: "error", message: "Invalid decision." };
  }

  const session = await requireSession();
  const supabase = await createClient();

  // RLS on approval_decisions enforces that the caller holds an approver role.
  const { error } = await supabase.from("approval_decisions").insert({
    approval_id: approvalId,
    decided_by: session.userId,
    decision,
    comment: comment || null,
    signature_name: signature || null,
  });

  if (error) {
    return {
      status: "error",
      message: error.message.includes("row-level security")
        ? "You are not an approver for this type of request."
        : error.message,
    };
  }

  // When a held payment is approved, release it into the ledger.
  const admin = createAdminClient();
  const { data: approval } = await admin
    .from("approvals")
    .select("status, type, subject_table, subject_id")
    .eq("id", approvalId)
    .maybeSingle();

  if (
    approval?.status === "approved" &&
    approval.type === "large_payment" &&
    approval.subject_table === "payments"
  ) {
    await admin.rpc("settle_payment", { p_payment: approval.subject_id });
  }

  revalidatePath("/estate/approvals");
  return { status: "success", message: `Recorded your ${decision === "approved" ? "approval" : "rejection"}.` };
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------

export async function publishAnnouncement(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const propertyId = String(formData.get("property_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();

  if (!title || !body) return { status: "error", message: "Give the notice a title and body." };

  try {
    const session = await assertRole(orgId, ["admin", "manager"]);
    const supabase = await createClient();

    const { error } = await supabase.from("announcements").insert({
      org_id: orgId,
      property_id: propertyId || null,
      author_id: session.userId,
      published_by: session.userId,
      title,
      body,
      category: String(formData.get("category") ?? "general"),
      severity: String(formData.get("severity") ?? "info") as Database["public"]["Enums"]["alert_severity"],
      is_pinned: formData.get("is_pinned") === "on",
      send_email: formData.get("send_email") === "on",
      send_sms: formData.get("send_sms") === "on",
    });

    if (error) return { status: "error", message: error.message };

    revalidatePath("/estate/announcements");
    return { status: "success", message: "Announcement published." };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Bulk campaigns
// ---------------------------------------------------------------------------

type AudienceFilter = {
  inArrears?: boolean;
  minBalance?: number;
  propertyId?: string;
};

/**
 * Resolve who a campaign goes to. Kept server-side and derived from the stored
 * filter so the recipient list cannot be tampered with from the browser.
 */
async function resolveRecipients(orgId: string, filter: AudienceFilter) {
  const admin = createAdminClient();

  let query = admin
    .from("tenant_accounts")
    .select(
      "id, balance, org_id, leases(unit_id, units(property_id), lease_tenants(profile_id, is_primary, profiles(email, phone, full_name, notify_email, notify_sms)))",
    )
    .eq("org_id", orgId);

  if (filter.inArrears) query = query.gt("balance", 0);
  if (filter.minBalance) query = query.gte("balance", filter.minBalance);

  const { data } = await query.limit(2000);

  return (data ?? [])
    .filter((account) => {
      if (!filter.propertyId) return true;
      const lease = account.leases as { units: { property_id: string } | null } | null;
      return lease?.units?.property_id === filter.propertyId;
    })
    .map((account) => {
      const lease = account.leases as {
        lease_tenants: Array<{
          profile_id: string;
          is_primary: boolean;
          profiles: {
            email: string;
            phone: string | null;
            full_name: string | null;
            notify_email: boolean;
            notify_sms: boolean;
          } | null;
        }>;
      } | null;

      const primary = lease?.lease_tenants.find((t) => t.is_primary) ?? lease?.lease_tenants[0];

      return {
        accountId: account.id,
        balance: account.balance,
        profileId: primary?.profile_id ?? null,
        profile: primary?.profiles ?? null,
      };
    })
    .filter((r) => r.profile !== null);
}

export async function createCampaign(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const channel = String(formData.get("channel") ?? "email") as "email" | "sms";
  const subject = String(formData.get("subject") ?? "").trim();
  const body = String(formData.get("body") ?? "").trim();
  const reason = String(formData.get("reason") ?? "general");
  const propertyId = String(formData.get("property_id") ?? "");
  const inArrears = formData.get("in_arrears") === "on";
  const sendNow = formData.get("send_now") === "on";

  if (!name || !body) return { status: "error", message: "Give the campaign a name and message." };
  if (channel === "email" && !subject) {
    return { status: "error", message: "Email campaigns need a subject." };
  }

  try {
    const session = await assertRole(orgId, ["admin", "manager", "finance"]);

    const filter: AudienceFilter = {
      inArrears,
      propertyId: propertyId || undefined,
    };

    const recipients = await resolveRecipients(orgId, filter);
    const admin = createAdminClient();

    const { data: campaign, error } = await admin
      .from("campaigns")
      .insert({
        org_id: orgId,
        property_id: propertyId || null,
        name,
        channel,
        status: sendNow ? "sending" : "draft",
        subject: subject || null,
        body,
        reason,
        audience_filter: filter as unknown as Database["public"]["Tables"]["campaigns"]["Insert"]["audience_filter"],
        recipient_count: recipients.length,
        created_by: session.userId,
        started_at: sendNow ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !campaign) {
      return { status: "error", message: error?.message ?? "Could not create the campaign." };
    }

    if (!sendNow) {
      revalidatePath("/estate/campaigns");
      return {
        status: "success",
        message: `Draft saved. ${recipients.length} recipient${recipients.length === 1 ? "" : "s"} match this filter.`,
      };
    }

    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      const profile = recipient.profile!;
      const to = channel === "email" ? profile.email : profile.phone;

      if (!to) {
        failed++;
        continue;
      }

      // Honour the tenant's notification preferences for anything that is not
      // a statutory billing notice.
      const optedIn = channel === "email" ? profile.notify_email : profile.notify_sms;
      if (!optedIn && reason === "general") continue;

      const personalised = body
        .replace(/\{\{name\}\}/g, profile.full_name ?? "there")
        .replace(/\{\{balance\}\}/g, formatMoney(recipient.balance));

      const rendered =
        channel === "email"
          ? await renderBrandedEmail(orgId, subject, `<p>${personalised.replace(/\n/g, "<br>")}</p>`)
          : personalised;

      const deliveryId = await dispatch({
        orgId,
        channel,
        to,
        subject: subject || undefined,
        body: rendered,
        campaignId: campaign.id,
        profileId: recipient.profileId,
        accountId: recipient.accountId,
      });

      if (deliveryId) sent++;
      else failed++;
    }

    await admin
      .from("campaigns")
      .update({
        status: "sent",
        sent_count: sent,
        failed_count: failed,
        completed_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    revalidatePath("/estate/campaigns");
    return {
      status: "success",
      message: `Sent ${sent} message${sent === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`,
    };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// DebiCheck
// ---------------------------------------------------------------------------

export async function createMandate(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const accountId = String(formData.get("account_id") ?? "");
  const profileId = String(formData.get("profile_id") ?? "");
  const instalment = Number(formData.get("instalment_amount") ?? 0);
  const maximum = Number(formData.get("maximum_amount") ?? 0);
  const collectionDay = Number(formData.get("collection_day") ?? 1);
  const branchCode = String(formData.get("branch_code") ?? "").trim();
  const accountNumber = String(formData.get("account_number") ?? "").trim();

  if (!Number.isFinite(instalment) || instalment <= 0) {
    return { status: "error", message: "Enter the instalment amount." };
  }
  if (maximum < instalment) {
    return { status: "error", message: "The maximum must be at least the instalment." };
  }

  try {
    await assertRole(orgId, ["admin", "finance"]);
    const admin = createAdminClient();

    const { data: reference } = await admin.rpc("next_sequence_number", {
      p_org: orgId,
      p_kind: "mandate",
      p_prefix: "DC",
    });

    const contractReference = reference ?? `DC-${randomUUID().slice(0, 8).toUpperCase()}`;

    const firstCollection = new Date();
    firstCollection.setMonth(firstCollection.getMonth() + 1, collectionDay);

    const { data: profile } = await admin
      .from("profiles")
      .select("full_name, id_number")
      .eq("id", profileId)
      .maybeSingle();

    const result = await getDebiCheckProvider().createMandate({
      contractReference,
      debtorName: profile?.full_name ?? "Unknown",
      debtorIdNumber: profile?.id_number,
      bankName: String(formData.get("bank_name") ?? ""),
      branchCode,
      accountNumber,
      accountType: String(formData.get("account_type") ?? "cheque") as "cheque" | "savings" | "transmission",
      instalmentCents: Math.round(instalment * 100),
      maximumCents: Math.round(maximum * 100),
      collectionDay,
      firstCollectionDate: firstCollection.toISOString().slice(0, 10),
      authenticationType: String(formData.get("authentication_type") ?? "TT1") as "TT1" | "TT2" | "TT3",
    });

    if (!result.ok) return { status: "error", message: result.error };

    const { data: mandate, error } = await admin
      .from("debicheck_mandates")
      .insert({
        org_id: orgId,
        account_id: accountId,
        profile_id: profileId,
        contract_reference: contractReference,
        mandate_reference: result.data.mandateReference,
        status: result.data.status === "authenticated" ? "authenticated" : "pending_authentication",
        instalment_amount: instalment,
        maximum_amount: maximum,
        collection_day: collectionDay,
        first_collection_date: firstCollection.toISOString().slice(0, 10),
        bank_name: String(formData.get("bank_name") ?? ""),
        branch_code: branchCode,
        // Only the last four digits are retained.
        account_number_masked: `····${accountNumber.slice(-4)}`,
        account_type: String(formData.get("account_type") ?? "cheque"),
        authentication_type: String(formData.get("authentication_type") ?? "TT1"),
        authenticated_at: result.data.status === "authenticated" ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (error || !mandate) {
      return { status: "error", message: error?.message ?? "Could not store the mandate." };
    }

    await admin.from("mandate_events").insert({
      mandate_id: mandate.id,
      event_type: "created",
      to_status: result.data.status === "authenticated" ? "authenticated" : "pending_authentication",
      payload: { provider: getDebiCheckProvider().name, reference: result.data.mandateReference },
    });

    revalidatePath("/estate/collections");

    return {
      status: "success",
      message:
        result.data.status === "authenticated"
          ? `Mandate ${contractReference} is authenticated.`
          : `Mandate ${contractReference} created. Waiting for the debtor to authenticate with their bank.`,
    };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}

/** Submit every due mandate for collection on a given action date. */
export async function runCollections(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const orgId = String(formData.get("org_id") ?? "");
  const actionDate = String(formData.get("action_date") ?? "");

  if (!actionDate) return { status: "error", message: "Choose an action date." };

  try {
    const session = await assertRole(orgId, ["admin", "finance"]);
    const admin = createAdminClient();

    const { data: mandates } = await admin
      .from("debicheck_mandates")
      .select("id, account_id, mandate_reference, instalment_amount, maximum_amount")
      .eq("org_id", orgId)
      .in("status", ["authenticated", "active"]);

    if (!mandates || mandates.length === 0) {
      return { status: "error", message: "No authenticated mandates to collect." };
    }

    const { data: run } = await admin
      .from("collection_runs")
      .insert({
        org_id: orgId,
        action_date: actionDate,
        status: "processing",
        mandate_count: mandates.length,
        submitted_at: new Date().toISOString(),
        created_by: session.userId,
      })
      .select("id")
      .single();

    let successful = 0;
    let failed = 0;
    let total = 0;
    const provider = getDebiCheckProvider();

    for (const mandate of mandates) {
      const amount = Number(mandate.instalment_amount);
      const reference = `${mandate.mandate_reference}-${actionDate}`;

      const result = await provider.submitCollection({
        mandateReference: mandate.mandate_reference ?? "",
        amountCents: Math.round(amount * 100),
        actionDate,
        reference,
      });

      const succeeded = result.ok && result.data.status === "successful";

      const { data: collection } = await admin
        .from("collections")
        .insert({
          org_id: orgId,
          run_id: run?.id ?? null,
          mandate_id: mandate.id,
          account_id: mandate.account_id,
          status: succeeded ? "successful" : "failed",
          amount,
          action_date: actionDate,
          submitted_at: new Date().toISOString(),
          resolved_at: new Date().toISOString(),
          response_code: result.ok ? result.data.responseCode : undefined,
          response_reason: result.ok ? result.data.responseReason : result.error,
        })
        .select("id")
        .single();

      if (succeeded) {
        successful++;
        total += amount;

        // A successful collection is a payment: record it and settle it so the
        // tenant's ledger reflects the money immediately.
        const { data: payment } = await admin
          .from("payments")
          .insert({
            org_id: orgId,
            account_id: mandate.account_id,
            reference,
            method: "debicheck",
            status: "captured",
            amount,
            gateway: provider.name,
            captured_at: new Date().toISOString(),
          })
          .select("id")
          .single();

        if (payment) {
          await admin.from("collections").update({ payment_id: payment.id }).eq("id", collection!.id);
          await admin.rpc("settle_payment", { p_payment: payment.id });
        }
      } else {
        failed++;
      }
    }

    if (run) {
      await admin
        .from("collection_runs")
        .update({
          status: "completed",
          successful_count: successful,
          failed_count: failed,
          total_amount: total,
          completed_at: new Date().toISOString(),
        })
        .eq("id", run.id);
    }

    await admin.rpc("refresh_account_ageing", { p_org: orgId });

    revalidatePath("/estate/collections");
    return {
      status: "success",
      message: `Collected ${formatMoney(total)} from ${successful} mandate${successful === 1 ? "" : "s"}${failed ? `, ${failed} failed` : ""}.`,
    };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Maintenance
// ---------------------------------------------------------------------------

export async function updateMaintenanceStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const requestId = String(formData.get("request_id") ?? "");
  const status = String(formData.get("status") ?? "") as Database["public"]["Enums"]["maintenance_status"];
  const note = String(formData.get("note") ?? "").trim();

  const session = await requireSession();
  const supabase = await createClient();

  const { data: current } = await supabase
    .from("maintenance_requests")
    .select("status")
    .eq("id", requestId)
    .maybeSingle();

  const timestamps: Record<string, string> = {};
  const now = new Date().toISOString();
  if (status === "acknowledged") timestamps.acknowledged_at = now;
  if (status === "resolved") timestamps.resolved_at = now;
  if (status === "closed") timestamps.closed_at = now;

  const { error } = await supabase
    .from("maintenance_requests")
    .update({ status, ...timestamps })
    .eq("id", requestId);

  if (error) return { status: "error", message: error.message };

  await supabase.from("maintenance_status_history").insert({
    request_id: requestId,
    from_status: current?.status ?? null,
    to_status: status,
    changed_by: session.userId,
    note: note || null,
  });

  revalidatePath("/estate/maintenance");
  return { status: "success", message: "Status updated." };
}

/** Acknowledge a high-consumption alert so it drops off the active list. */
export async function acknowledgeUsageAlert(alertId: string): Promise<ActionState> {
  const session = await requireSession();
  const supabase = await createClient();

  const { error } = await supabase
    .from("usage_alerts")
    .update({
      is_acknowledged: true,
      acknowledged_by: session.userId,
      acknowledged_at: new Date().toISOString(),
    })
    .eq("id", alertId);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/estate/usage");
  return { status: "success", message: "Alert acknowledged." };
}

/** Recompute behaviour scores for every tenant in the org. */
export async function refreshTenantScores(orgId: string): Promise<ActionState> {
  try {
    await assertRole(orgId, ["admin", "finance", "manager"]);
    const admin = createAdminClient();

    const { data: tenants } = await admin
      .from("lease_tenants")
      .select("profile_id, leases!inner(org_id)")
      .eq("leases.org_id", orgId);

    const unique = [...new Set((tenants ?? []).map((t) => t.profile_id))];

    for (const profileId of unique) {
      await admin.rpc("compute_tenant_score", { p_org: orgId, p_profile: profileId });
    }

    revalidatePath("/estate/tenants");
    return { status: "success", message: `Recalculated ${unique.length} score${unique.length === 1 ? "" : "s"}.` };
  } catch (error) {
    return { status: "error", message: (error as Error).message };
  }
}
