"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getEmailProvider, getSmsProvider } from "@/lib/integrations";
import { normaliseMsisdn } from "@/lib/integrations/mock";
import { formatMoney } from "@/lib/domain/money";

/**
 * Transactional notifications.
 *
 * Every send is written to `message_deliveries` first and then updated with the
 * provider's receipt, so the delivery trail in the estate and admin portals is
 * complete even when a provider fails.
 */

type Branding = {
  name: string;
  primary_color: string;
  font_family: string;
  email_header_html: string | null;
  email_footer_html: string | null;
  statement_footer: string | null;
  postal_address: string | null;
  logo_url: string | null;
};

/** Wrap body copy in the org's letterhead so email matches the statements. */
export async function renderBrandedEmail(orgId: string, title: string, bodyHtml: string) {
  const admin = createAdminClient();

  const { data } = await admin
    .from("org_branding")
    .select(
      "primary_color, font_family, email_header_html, email_footer_html, statement_footer, postal_address, logo_url, organisations(name)",
    )
    .eq("org_id", orgId)
    .maybeSingle();

  const org = data?.organisations as { name: string } | null;
  const brand: Branding = {
    name: org?.name ?? "veriBills",
    primary_color: data?.primary_color ?? "#0f766e",
    font_family: data?.font_family ?? "Inter",
    email_header_html: data?.email_header_html ?? null,
    email_footer_html: data?.email_footer_html ?? null,
    statement_footer: data?.statement_footer ?? null,
    postal_address: data?.postal_address ?? null,
    logo_url: data?.logo_url ?? null,
  };

  const header =
    brand.email_header_html ??
    `<div style="background:${brand.primary_color};padding:20px 24px;color:#fff">
       ${
         brand.logo_url
           ? `<img src="${brand.logo_url}" alt="${escapeHtml(brand.name)}" style="max-height:36px">`
           : `<strong style="font-size:18px">${escapeHtml(brand.name)}</strong>`
       }
     </div>`;

  const footer =
    brand.email_footer_html ??
    `<div style="padding:16px 24px;color:#64748b;font-size:12px;border-top:1px solid #e2e8f0">
       ${escapeHtml(brand.statement_footer ?? "")}<br>${escapeHtml(brand.postal_address ?? "")}
     </div>`;

  return `<div style="font-family:${brand.font_family},Arial,sans-serif;max-width:600px;margin:0 auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden">
    ${header}
    <div style="padding:24px;color:#0f172a;font-size:14px;line-height:1.6">
      <h1 style="font-size:18px;margin:0 0 12px">${escapeHtml(title)}</h1>
      ${bodyHtml}
    </div>
    ${footer}
  </div>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Record and dispatch one message, returning the delivery id.
 * Failures are recorded rather than thrown: a receipt that cannot be emailed
 * must not roll back the payment it describes.
 */
export async function dispatch(options: {
  orgId: string;
  channel: "email" | "sms";
  to: string;
  subject?: string;
  body: string;
  templateKey?: string;
  profileId?: string | null;
  accountId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  campaignId?: string | null;
}): Promise<string | null> {
  const admin = createAdminClient();

  const { data: delivery } = await admin
    .from("message_deliveries")
    .insert({
      org_id: options.orgId,
      channel: options.channel,
      status: "queued",
      to_address: options.to,
      subject: options.subject,
      body_preview: options.body.replace(/<[^>]+>/g, " ").slice(0, 240),
      template_key: options.templateKey,
      profile_id: options.profileId ?? null,
      account_id: options.accountId ?? null,
      invoice_id: options.invoiceId ?? null,
      payment_id: options.paymentId ?? null,
      campaign_id: options.campaignId ?? null,
      provider: options.channel === "email" ? getEmailProvider().name : getSmsProvider().name,
    })
    .select("id")
    .single();

  if (!delivery) return null;

  const now = new Date().toISOString();

  if (options.channel === "email") {
    const result = await getEmailProvider().send({
      to: options.to,
      subject: options.subject ?? "veriBills",
      html: options.body,
      from: process.env.EMAIL_FROM,
      tag: delivery.id,
    });

    await admin
      .from("message_deliveries")
      .update(
        result.ok
          ? { status: "sent", sent_at: now, provider_message_id: result.data.providerMessageId }
          : { status: "failed", failed_at: now, failure_reason: result.error },
      )
      .eq("id", delivery.id);
  } else {
    const msisdn = normaliseMsisdn(options.to);

    if (!msisdn) {
      await admin
        .from("message_deliveries")
        .update({ status: "failed", failed_at: now, failure_reason: "Invalid mobile number" })
        .eq("id", delivery.id);
      return delivery.id;
    }

    const result = await getSmsProvider().send({
      to: msisdn,
      body: options.body,
      senderId: process.env.SMS_SENDER_ID,
      tag: delivery.id,
    });

    await admin
      .from("message_deliveries")
      .update(
        result.ok
          ? {
              status: "sent",
              sent_at: now,
              provider_message_id: result.data.providerMessageId,
              segments: result.data.segments,
              cost: result.data.costCents ? result.data.costCents / 100 : null,
            }
          : { status: "failed", failed_at: now, failure_reason: result.error },
      )
      .eq("id", delivery.id);
  }

  return delivery.id;
}

/** Payment confirmation over both email and SMS, per the tenant's preferences. */
export async function sendPaymentReceipt(paymentId: string) {
  const admin = createAdminClient();

  const { data: payment } = await admin
    .from("payments")
    .select(
      "id, org_id, amount, reference, account_id, captured_at, profiles(email, phone, full_name, notify_email, notify_sms), tenant_accounts(account_number, balance)",
    )
    .eq("id", paymentId)
    .maybeSingle();

  if (!payment) return;

  const profile = payment.profiles as {
    email: string;
    phone: string | null;
    full_name: string | null;
    notify_email: boolean;
    notify_sms: boolean;
  } | null;

  const account = payment.tenant_accounts as { account_number: string; balance: string } | null;
  if (!profile) return;

  const amount = formatMoney(payment.amount);
  const balance = formatMoney(account?.balance ?? 0);

  if (profile.notify_email && profile.email) {
    const html = await renderBrandedEmail(
      payment.org_id,
      "Payment received",
      `<p>Hi ${escapeHtml(profile.full_name ?? "there")},</p>
       <p>We have received your payment of <strong>${amount}</strong> towards account
       ${escapeHtml(account?.account_number ?? "")}.</p>
       <table style="width:100%;border-collapse:collapse;margin:16px 0">
         <tr><td style="padding:6px 0;color:#64748b">Reference</td><td style="text-align:right"><strong>${escapeHtml(payment.reference)}</strong></td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Amount</td><td style="text-align:right"><strong>${amount}</strong></td></tr>
         <tr><td style="padding:6px 0;color:#64748b">Balance after payment</td><td style="text-align:right"><strong>${balance}</strong></td></tr>
       </table>
       <p>Thank you.</p>`,
    );

    await dispatch({
      orgId: payment.org_id,
      channel: "email",
      to: profile.email,
      subject: `Payment received – ${amount}`,
      body: html,
      templateKey: "payment_receipt",
      paymentId: payment.id,
      accountId: payment.account_id,
    });
  }

  if (profile.notify_sms && profile.phone) {
    await dispatch({
      orgId: payment.org_id,
      channel: "sms",
      to: profile.phone,
      body: `veriBills: payment of ${amount} received (ref ${payment.reference}). Balance now ${balance}.`,
      templateKey: "payment_receipt",
      paymentId: payment.id,
      accountId: payment.account_id,
    });
  }

  await admin
    .from("payments")
    .update({ receipt_sent_at: new Date().toISOString() })
    .eq("id", paymentId);
}

/** Prepaid token delivery: the token itself goes by SMS, which is what tenants expect. */
export async function sendElectricityToken(purchaseId: string) {
  const admin = createAdminClient();

  const { data: purchase } = await admin
    .from("electricity_purchases")
    .select(
      "id, org_id, token, units_kwh, gross_amount, reference, debt_recovered, profiles(email, phone, full_name, notify_email, notify_sms), meters(meter_number)",
    )
    .eq("id", purchaseId)
    .maybeSingle();

  if (!purchase?.token) return;

  const profile = purchase.profiles as {
    email: string;
    phone: string | null;
    full_name: string | null;
    notify_email: boolean;
    notify_sms: boolean;
  } | null;
  const meter = purchase.meters as { meter_number: string } | null;

  if (!profile) return;

  const units = Number(purchase.units_kwh ?? 0).toFixed(2);
  const amount = formatMoney(purchase.gross_amount);
  const debt = Number(purchase.debt_recovered ?? 0);

  if (profile.phone) {
    await dispatch({
      orgId: purchase.org_id,
      channel: "sms",
      to: profile.phone,
      body: `veriBills electricity token for meter ${meter?.meter_number ?? ""}: ${purchase.token}. ${units} kWh for ${amount}.${debt > 0 ? ` ${formatMoney(debt)} recovered towards arrears.` : ""}`,
      templateKey: "electricity_token",
    });
  }

  if (profile.notify_email && profile.email) {
    const html = await renderBrandedEmail(
      purchase.org_id,
      "Your prepaid electricity token",
      `<p>Hi ${escapeHtml(profile.full_name ?? "there")},</p>
       <p>Here is your token for meter <strong>${escapeHtml(meter?.meter_number ?? "")}</strong>:</p>
       <p style="font-family:monospace;font-size:22px;letter-spacing:2px;background:#f1f5f9;padding:14px;border-radius:8px;text-align:center">
         ${escapeHtml(purchase.token)}
       </p>
       <p>${units} kWh purchased for ${amount}.${debt > 0 ? ` ${formatMoney(debt)} was recovered towards your arrears.` : ""}</p>
       <p>Enter the token on your meter keypad to load the units.</p>`,
    );

    await dispatch({
      orgId: purchase.org_id,
      channel: "email",
      to: profile.email,
      subject: `Electricity token – ${units} kWh`,
      body: html,
      templateKey: "electricity_token",
    });
  }

  await admin
    .from("electricity_purchases")
    .update({
      status: "delivered",
      delivered_at: new Date().toISOString(),
      delivery_channel: profile.phone ? "sms" : "email",
      receipt_sent_at: new Date().toISOString(),
    })
    .eq("id", purchaseId);
}
