import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { CampaignForm } from "@/components/estate/campaign-form";
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

export const metadata = { title: "Campaigns" };

export default async function CampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [campaigns, properties, deliveries] = await Promise.all([
    supabase
      .from("campaigns")
      .select(
        "id, name, channel, status, reason, recipient_count, sent_count, delivered_count, opened_count, failed_count, paid_count, created_at",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(25),
    supabase.from("properties").select("id, name").eq("org_id", orgId).eq("is_active", true),
    supabase
      .from("message_deliveries")
      .select("id, channel, status, to_address, subject, sent_at, failure_reason, profiles(full_name)")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const totals = (campaigns.data ?? []).reduce(
    (acc, c) => {
      acc.sent += c.sent_count;
      acc.failed += c.failed_count;
      acc.opened += c.opened_count;
      return acc;
    },
    { sent: 0, failed: 0, opened: 0 },
  );

  return (
    <>
      <PageHeader
        title="Bulk email and SMS"
        description="Bill presentment, arrears reminders and estate notices."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatTile label="Campaigns" value={campaigns.data?.length ?? 0} />
        <StatTile label="Messages sent" value={totals.sent} />
        <StatTile label="Opened" value={totals.opened} tone="success" />
        <StatTile label="Failed" value={totals.failed} tone={totals.failed ? "danger" : "success"} />
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card
          title="New campaign"
          description="Filter the audience, then save a draft or send it now."
        >
          <CampaignForm orgId={orgId} properties={properties.data ?? []} />
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card title="Campaigns">
            {campaigns.data && campaigns.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Name</Th>
                    <Th>Channel</Th>
                    <Th>Reason</Th>
                    <Th align="right">Recipients</Th>
                    <Th align="right">Sent</Th>
                    <Th align="right">Failed</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.data.map((campaign) => (
                    <tr key={campaign.id}>
                      <Td>{campaign.name}</Td>
                      <Td>{humanise(campaign.channel)}</Td>
                      <Td>{humanise(campaign.reason)}</Td>
                      <Td align="right">{campaign.recipient_count}</Td>
                      <Td align="right">{campaign.sent_count}</Td>
                      <Td align="right" className={campaign.failed_count ? "text-red-600" : ""}>
                        {campaign.failed_count}
                      </Td>
                      <Td>
                        <StatusBadge status={campaign.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No campaigns yet"
                description="Send your first bill presentment or arrears reminder."
              />
            )}
          </Card>

          <Card
            title="Delivery trail"
            description="Per-message status across email and SMS."
          >
            {deliveries.data && deliveries.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Recipient</Th>
                    <Th>Channel</Th>
                    <Th>Subject</Th>
                    <Th>Sent</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.data.map((delivery) => (
                    <tr key={delivery.id}>
                      <Td>
                        {(delivery.profiles as { full_name: string | null } | null)?.full_name ??
                          delivery.to_address}
                        <span className="block text-xs text-slate-500 dark:text-slate-400">
                          {delivery.to_address}
                        </span>
                      </Td>
                      <Td>{humanise(delivery.channel)}</Td>
                      <Td className="max-w-[14rem] truncate">{delivery.subject ?? "—"}</Td>
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
                        <StatusBadge status={delivery.status} />
                        {delivery.failure_reason && (
                          <span className="block text-xs text-red-500">
                            {delivery.failure_reason}
                          </span>
                        )}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No messages sent yet" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
