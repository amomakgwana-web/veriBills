import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import { integrationStatus } from "@/lib/integrations";
import { HealthCheckButton } from "@/components/admin/health-check";
import {
  Badge,
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

export const metadata = { title: "System health" };

export default async function HealthPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const [checks, webhooks, failedDeliveries, failedPayments] = await Promise.all([
    supabase
      .from("system_health_checks")
      .select("id, component, status, latency_ms, detail, checked_at")
      .order("checked_at", { ascending: false })
      .limit(40),
    supabase
      .from("webhook_events")
      .select("id, provider, event_type, processed_at, processing_error, received_at")
      .order("received_at", { ascending: false })
      .limit(20),
    supabase
      .from("message_deliveries")
      .select("id, channel, to_address, failure_reason, failed_at")
      .in("status", ["failed", "bounced"])
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("payments")
      .select("id, reference, amount, failure_code, failure_reason, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  // Latest status per component, since the table is an append-only log.
  type HealthCheck = NonNullable<typeof checks.data>[number];
  const latest = new Map<string, HealthCheck>();
  for (const check of checks.data ?? []) {
    if (!latest.has(check.component)) latest.set(check.component, check);
  }

  const components = [...latest.values()];
  const unhealthy = components.filter((c) => c.status !== "healthy");
  const providers = integrationStatus();

  return (
    <>
      <PageHeader
        title="System health"
        description="Component probes, webhook processing and recent failures."
        action={<HealthCheckButton />}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile
          label="Components"
          value={components.length}
          hint={unhealthy.length ? `${unhealthy.length} unhealthy` : "All healthy"}
          tone={unhealthy.length ? "danger" : "success"}
        />
        <StatTile
          label="Service role"
          value={hasServiceRole() ? "Configured" : "Missing"}
          tone={hasServiceRole() ? "success" : "danger"}
        />
        <StatTile
          label="Failed messages"
          value={failedDeliveries.data?.length ?? 0}
          tone={(failedDeliveries.data?.length ?? 0) > 0 ? "warning" : "success"}
        />
        <StatTile
          label="Failed payments"
          value={failedPayments.data?.length ?? 0}
          tone={(failedPayments.data?.length ?? 0) > 0 ? "warning" : "success"}
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Card title="Component status">
          {components.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Component</Th>
                  <Th align="right">Latency</Th>
                  <Th>Checked</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {components.map((check) => (
                  <tr key={check.id}>
                    <Td>{humanise(check.component)}</Td>
                    <Td align="right">{check.latency_ms ? `${check.latency_ms} ms` : "—"}</Td>
                    <Td>
                      {new Date(check.checked_at).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td>
                      <StatusBadge status={check.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No probes recorded"
              description="Run a health check to populate this."
            />
          )}
        </Card>

        <Card title="Provider configuration">
          <TableWrap>
            <thead>
              <tr>
                <Th>Provider</Th>
                <Th>Environment value</Th>
                <Th>Active</Th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.label}>
                  <Td>{provider.label}</Td>
                  <Td>
                    <code className="text-xs text-slate-500">{provider.configured}</code>
                  </Td>
                  <Td>
                    <Badge tone={provider.isMock ? "warning" : "success"}>
                      {provider.isMock ? "Mock" : provider.active}
                    </Badge>
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>

        <Card title="Webhook events">
          {webhooks.data && webhooks.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Provider</Th>
                  <Th>Event</Th>
                  <Th>Received</Th>
                  <Th>Processed</Th>
                </tr>
              </thead>
              <tbody>
                {webhooks.data.map((event) => (
                  <tr key={event.id}>
                    <Td>{event.provider}</Td>
                    <Td>{event.event_type}</Td>
                    <Td>
                      {new Date(event.received_at).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td>
                      {event.processing_error ? (
                        <Badge tone="danger">Error</Badge>
                      ) : event.processed_at ? (
                        <Badge tone="success">Processed</Badge>
                      ) : (
                        <Badge tone="warning">Pending</Badge>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="No webhooks received" />
          )}
        </Card>

        <Card title="Recent failures">
          {(failedDeliveries.data?.length ?? 0) + (failedPayments.data?.length ?? 0) > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Type</Th>
                  <Th>Target</Th>
                  <Th>Reason</Th>
                </tr>
              </thead>
              <tbody>
                {(failedPayments.data ?? []).map((payment) => (
                  <tr key={payment.id}>
                    <Td>
                      <Badge tone="danger">Payment</Badge>
                    </Td>
                    <Td>{payment.reference}</Td>
                    <Td>
                      {payment.failure_code ? `${payment.failure_code} · ` : ""}
                      {payment.failure_reason ?? "Unknown"}
                    </Td>
                  </tr>
                ))}
                {(failedDeliveries.data ?? []).map((delivery) => (
                  <tr key={delivery.id}>
                    <Td>
                      <Badge tone="warning">{humanise(delivery.channel)}</Badge>
                    </Td>
                    <Td>{delivery.to_address}</Td>
                    <Td>{delivery.failure_reason ?? "Unknown"}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="No recent failures" />
          )}
        </Card>
      </div>
    </>
  );
}
