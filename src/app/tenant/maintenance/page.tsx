import Link from "next/link";

import { resolveUnit } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import {
  Badge,
  Card,
  EmptyState,
  LinkButton,
  PageHeader,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Maintenance" };

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit } = await resolveUnit(searchParams);
  const supabase = await createClient();

  const { data: requests } = await supabase
    .from("maintenance_requests")
    .select(
      "id, reference, title, category, priority, status, created_at, scheduled_for, resolved_at, actual_cost, is_tenant_liable",
    )
    .eq("unit_id", unit.unitId)
    .order("created_at", { ascending: false })
    .limit(40);

  const open = (requests ?? []).filter((r) => !["closed", "resolved"].includes(r.status));
  const closed = (requests ?? []).filter((r) => ["closed", "resolved"].includes(r.status));

  return (
    <>
      <PageHeader
        title="Maintenance"
        description={`Unit ${unit.unitNumber} · ${unit.propertyName}`}
        action={<LinkButton href={`/tenant/maintenance/new?unit=${unit.unitId}`}>Log a request</LinkButton>}
      />

      <Card title={`Open requests (${open.length})`} className="mb-5">
        {open.length > 0 ? (
          <RequestTable requests={open} />
        ) : (
          <EmptyState
            title="Nothing outstanding"
            description="Anything you report will be tracked here until it is resolved."
          />
        )}
      </Card>

      <Card title="History">
        {closed.length > 0 ? (
          <RequestTable requests={closed} />
        ) : (
          <EmptyState title="No past requests" />
        )}
      </Card>
    </>
  );
}

function RequestTable({
  requests,
}: {
  requests: Array<{
    id: string;
    reference: string;
    title: string;
    category: string;
    priority: string;
    status: string;
    created_at: string;
    actual_cost: number | null;
    is_tenant_liable: boolean;
  }>;
}) {
  return (
    <TableWrap>
      <thead>
        <tr>
          <Th>Reference</Th>
          <Th>Issue</Th>
          <Th>Category</Th>
          <Th>Priority</Th>
          <Th>Logged</Th>
          <Th align="right">Cost to you</Th>
          <Th>Status</Th>
        </tr>
      </thead>
      <tbody>
        {requests.map((request) => (
          <tr key={request.id}>
            <Td>
              <Link
                href={`/tenant/maintenance/${request.id}`}
                className="text-brand-700 dark:text-brand-400 font-medium"
              >
                {request.reference}
              </Link>
            </Td>
            <Td>{request.title}</Td>
            <Td>{humanise(request.category)}</Td>
            <Td>
              <Badge
                tone={
                  request.priority === "emergency"
                    ? "danger"
                    : request.priority === "high"
                      ? "warning"
                      : "neutral"
                }
              >
                {humanise(request.priority)}
              </Badge>
            </Td>
            <Td>
              {new Date(request.created_at).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
              })}
            </Td>
            <Td align="right">
              {request.is_tenant_liable && request.actual_cost
                ? formatMoney(request.actual_cost)
                : "—"}
            </Td>
            <Td>
              <StatusBadge status={request.status} />
            </Td>
          </tr>
        ))}
      </tbody>
    </TableWrap>
  );
}
