import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { formatMoney, formatNumber } from "@/lib/domain/money";

type Action = { label: string; href: string };

/**
 * Support assistant.
 *
 * Intents are matched by keyword and answered from the caller's own data,
 * read through their session so RLS applies. The matcher is deliberately
 * simple; swapping it for a model-backed responder means replacing `respond`
 * while the persistence and transport around it stay as they are.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  let message = "";
  try {
    const body = (await request.json()) as { message?: unknown };
    message = typeof body.message === "string" ? body.message.slice(0, 1000) : "";
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!message.trim()) {
    return NextResponse.json({ error: "Message is required" }, { status: 400 });
  }

  const supabase = await createClient();

  // Persist the conversation so estate staff can pick up an escalation.
  const { data: existing } = await supabase
    .from("chat_conversations")
    .select("id")
    .eq("profile_id", session.userId)
    .eq("status", "open")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let conversationId = existing?.id;

  if (!conversationId) {
    const { data: created } = await supabase
      .from("chat_conversations")
      .insert({
        profile_id: session.userId,
        org_id: session.units[0]?.orgId ?? session.memberships[0]?.orgId ?? null,
        subject: message.slice(0, 80),
      })
      .select("id")
      .single();
    conversationId = created?.id;
  }

  if (conversationId) {
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "user",
      author_id: session.userId,
      body: message,
    });
  }

  const { reply, actions } = await respond(message, session.userId, supabase);

  if (conversationId) {
    await supabase.from("chat_messages").insert({
      conversation_id: conversationId,
      role: "assistant",
      body: reply,
      actions: actions ?? [],
    });
  }

  return NextResponse.json({ reply, actions });
}

async function respond(
  message: string,
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>,
): Promise<{ reply: string; actions?: Action[] }> {
  const text = message.toLowerCase();

  const has = (...words: string[]) => words.some((w) => text.includes(w));

  if (has("balance", "owe", "outstanding", "how much", "arrears")) {
    const { data } = await supabase
      .from("tenant_accounts")
      .select("account_number, balance, current_due, leases(units(unit_number))")
      .limit(5);

    if (!data || data.length === 0) {
      return { reply: "I could not find an account linked to your profile." };
    }

    const lines = data.map((account) => {
      const lease = account.leases as { units: { unit_number: string } | null } | null;
      const balance = Number(account.balance);
      return `Unit ${lease?.units?.unit_number ?? account.account_number}: ${formatMoney(balance)}${
        balance > 0 ? " outstanding" : balance < 0 ? " in credit" : " — all settled"
      }`;
    });

    return {
      reply: lines.join("\n"),
      actions: [{ label: "Pay now", href: "/tenant/billing" }],
    };
  }

  if (has("electricity", "prepaid", "token", "units", "kwh")) {
    const { data } = await supabase
      .from("electricity_purchases")
      .select("token, units_kwh, gross_amount, created_at, status")
      .order("created_at", { ascending: false })
      .limit(1);

    const last = data?.[0];

    if (last?.token) {
      return {
        reply: `Your last purchase was ${formatNumber(last.units_kwh, 2)} kWh for ${formatMoney(
          last.gross_amount,
        )} on ${new Date(last.created_at).toLocaleDateString("en-ZA")}.\nToken: ${last.token}`,
        actions: [{ label: "Buy more", href: "/tenant/electricity" }],
      };
    }

    return {
      reply: "I do not see any prepaid purchases on your unit yet. You can buy units from the electricity page.",
      actions: [{ label: "Buy electricity", href: "/tenant/electricity" }],
    };
  }

  if (has("leak", "broken", "repair", "maintenance", "fix", "not working", "geyser")) {
    return {
      reply:
        "I can get that logged for you. Maintenance requests go straight to the estate team, and you can track progress in the portal. Emergencies are escalated immediately.",
      actions: [
        { label: "Log a request", href: "/tenant/maintenance/new" },
        { label: "My requests", href: "/tenant/maintenance" },
      ],
    };
  }

  if (has("visitor", "gate", "access code", "delivery", "guest")) {
    return {
      reply:
        "You can generate a gate code for a visitor, delivery or contractor. Codes are single-use by default and expire automatically.",
      actions: [{ label: "Create a code", href: "/tenant/access" }],
    };
  }

  if (has("invoice", "statement", "bill", "charged")) {
    const { data } = await supabase
      .from("invoices")
      .select("invoice_number, total, amount_due, due_date, status")
      .order("due_date", { ascending: false })
      .limit(1);

    const invoice = data?.[0];
    if (invoice) {
      return {
        reply: `Your latest invoice is ${invoice.invoice_number} for ${formatMoney(
          invoice.total,
        )}, due ${new Date(invoice.due_date).toLocaleDateString("en-ZA")}. Outstanding: ${formatMoney(
          invoice.amount_due,
        )}.`,
        actions: [{ label: "View billing", href: "/tenant/billing" }],
      };
    }

    return { reply: "You do not have any invoices yet." };
  }

  if (has("payment plan", "arrangement", "instalment", "cannot pay", "can't pay")) {
    return {
      reply:
        "If you are struggling to settle the full balance, the estate can set up a payment arrangement that spreads the arrears over several months. Ask them through the billing page and they will propose a plan you can accept online.",
      actions: [{ label: "Billing", href: "/tenant/billing" }],
    };
  }

  if (has("gym", "pool", "clubhouse", "facility", "booking", "braai")) {
    return {
      reply:
        "Facility access and bookings live under Facilities. Note that some facilities need your account to be in good standing.",
      actions: [{ label: "Facilities", href: "/tenant/facilities" }],
    };
  }

  if (has("lease", "policy", "rules", "document", "contract")) {
    return {
      reply: "Your signed lease and the estate policies are under Documents.",
      actions: [{ label: "Documents", href: "/tenant/documents" }],
    };
  }

  if (has("debicheck", "debit order", "mandate")) {
    return {
      reply:
        "A DebiCheck mandate lets the estate collect your monthly charges automatically. You authenticate it once with your bank, and you can see its status on the billing page.",
      actions: [{ label: "Billing", href: "/tenant/billing" }],
    };
  }

  if (has("hello", "hi ", "hey", "good morning", "good afternoon")) {
    return {
      reply: "Hello! Ask me about your balance, electricity, maintenance or visitor codes.",
    };
  }

  return {
    reply:
      "I can help with your balance and invoices, prepaid electricity, maintenance requests, visitor access codes, facilities and documents. If you need a person, log a maintenance request or contact your estate office and someone will pick it up.",
    actions: [
      { label: "Billing", href: "/tenant/billing" },
      { label: "Maintenance", href: "/tenant/maintenance" },
    ],
  };
}
