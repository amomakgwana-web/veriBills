import Link from "next/link";

import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/domain/money";
import {
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Delivery trail" };

const STATUSES = [
  "queued",
  "sent",
  "delivered",
  "opened",
  "clicked",
  "failed",
  "bounced",
] as const;

const CHANNELS = ["email", "sms", "push", "whatsapp"] as const;

export default async function DeliveriesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; channel?: string }>;
}) {
  await requireSystemAdmin();
  const params = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("message_deliveries")
    .select(
      "id, channel, status, to_address, subject, provider, provider_message_id, queued_at, sent_at, delivered_at, opened_at, failed_at, failure_reason, cost, segments, paid_at, organisations(name), profiles(full_name)",
    )
    .order("created_at", { ascending: false })
    .limit(120);

  // Narrow the raw query strings to the enum values the column accepts.
  const status = STATUSES.find((s) => s === params.status);
  const channel = CHANNELS.find((c) => c === params.channel);

  if (status) query = query.eq("status", status);
  if (channel) query = query.eq("channel", channel);

  const [deliveries, all] = await Promise.all([
    query,
    supabase.from("message_deliveries").select("id, status, channel, cost, paid_at").limit(5000),
  ]);

  const rows = all.data ?? [];
  const sent = rows.filter((d) => d.status !== "queued").length;
  const opened = rows.filter((d) => ["opened", "clicked"].includes(d.status)).length;
  const failed = rows.filter((d) => ["failed", "bounced"].includes(d.status)).length;
  const paid = rows.filter((d) => d.paid_at !== null).length;
  const smsCost = rows.reduce((sum, d) => sum + Number(d.cost ?? 0), 0);

  return (
    <>
      <PageHeader
        title="Email and SMS delivery trail"
        description="Every message the platform has sent, with engagement and payment attribution."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="Total messages" value={rows.length} />
        <StatTile label="Sent" value={sent} />
        <StatTile
          label="Opened"
          value={sent > 0 ? `${formatNumber((opened / sent) * 100, 0)}%` : "—"}
          hint={`${opened} messages`}
          tone="success"
        />
        <StatTile
          label="Failed"
          value={failed}
          tone={failed ? "danger" : "success"}
        />
        <StatTile
          label="Paid after receiving"
          value={paid}
          hint={smsCost > 0 ? `SMS spend ${formatMoney(smsCost)}` : undefined}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-1.5">
        <Chip label="All" active={!params.status && !params.channel} href="/admin/deliveries" />
        <Chip
          label="Email"
          active={params.channel === "email"}
          href="/admin/deliveries?channel=email"
        />
        <Chip label="SMS" active={params.channel === "sms"} href="/admin/deliveries?channel=sms" />
        {STATUSES.map((status) => (
          <Chip
            key={status}
            label={humanise(status)}
            active={params.status === status}
            href={`/admin/deliveries?status=${status}`}
          />
        ))}
      </div>

      <Card>
        {deliveries.data && deliveries.data.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Recipient</Th>
                <Th>Organisation</Th>
                <Th>Channel</Th>
                <Th>Subject</Th>
                <Th>Provider ref</Th>
                <Th>Sent</Th>
                <Th>Opened</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {deliveries.data.map((delivery) => (
                <tr key={delivery.id}>
                  <Td>
                    {(delivery.profiles as { full_name: string | null } | null)?.full_name ?? "—"}
                    <span className="block text-xs text-slate-500">
                      {delivery.to_address}
                    </span>
                  </Td>
                  <Td>{(delivery.organisations as { name: string } | null)?.name ?? "—"}</Td>
                  <Td>
                    {humanise(delivery.channel)}
                    {delivery.segments && (
                      <span className="block text-xs text-slate-500">
                        {delivery.segments} segment{delivery.segments === 1 ? "" : "s"}
                      </span>
                    )}
                  </Td>
                  <Td className="max-w-[14rem] truncate">{delivery.subject ?? "—"}</Td>
                  <Td>
                    <code className="text-xs text-slate-500">
                      {delivery.provider_message_id?.slice(0, 16) ?? "—"}
                    </code>
                  </Td>
                  <Td>
                    {delivery.sent_at
                      ? new Date(delivery.sent_at).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Td>
                  <Td>
                    {delivery.opened_at
                      ? new Date(delivery.opened_at).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </Td>
                  <Td>
                    <StatusBadge status={delivery.status} />
                    {delivery.failure_reason && (
                      <span className="block text-xs text-red-500">{delivery.failure_reason}</span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No messages match this filter" />
        )}
      </Card>
    </>
  );
}

function Chip({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "bg-brand-700 rounded-full px-2.5 py-1 text-xs font-medium text-white"
          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
      }
    >
      {label}
    </Link>
  );
}
