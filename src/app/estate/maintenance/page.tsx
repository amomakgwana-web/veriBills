import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { MaintenanceStatusForm } from "@/components/estate/maintenance-status";
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

export const metadata = { title: "Maintenance" };

export default async function EstateMaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [requests, contractors] = await Promise.all([
    supabase
      .from("maintenance_requests")
      .select(
        "id, reference, title, description, category, priority, status, created_at, scheduled_for, estimated_cost, actual_cost, is_tenant_liable, units(unit_number, properties(name)), profiles!maintenance_requests_reported_by_fkey(full_name)",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(60),
    supabase
      .from("contractors")
      .select("id, name, trade, phone, rating, is_active")
      .eq("org_id", orgId)
      .eq("is_active", true),
  ]);

  const all = requests.data ?? [];
  const open = all.filter((r) => !["closed", "resolved"].includes(r.status));
  const emergencies = open.filter((r) => r.priority === "emergency");
  const unassigned = open.filter((r) => r.status === "logged");

  return (
    <>
      <PageHeader
        title="Maintenance"
        description="Requests logged by tenants and picked up by the estate team."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Open" value={open.length} />
        <StatTile label="Emergencies" value={emergencies.length} tone={emergencies.length ? "danger" : "success"} />
        <StatTile label="Not yet actioned" value={unassigned.length} tone={unassigned.length ? "warning" : "success"} />
        <StatTile label="Contractors" value={contractors.data?.length ?? 0} />
      </div>

      <Card title={`Open requests (${open.length})`} className="mb-5">
        {open.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Ref</Th>
                <Th>Unit</Th>
                <Th>Issue</Th>
                <Th>Reported by</Th>
                <Th>Priority</Th>
                <Th>Logged</Th>
                <Th>Status</Th>
                <Th>Update</Th>
              </tr>
            </thead>
            <tbody>
              {open.map((request) => {
                const unit = request.units as {
                  unit_number: string;
                  properties: { name: string } | null;
                } | null;
                const reporter = request.profiles as { full_name: string | null } | null;

                return (
                  <tr key={request.id}>
                    <Td>{request.reference}</Td>
                    <Td>
                      {unit?.unit_number ?? "—"}
                      <span className="block text-xs text-slate-500">
                        {unit?.properties?.name}
                      </span>
                    </Td>
                    <Td className="max-w-[16rem]">
                      <span className="font-medium text-slate-800">
                        {request.title}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {humanise(request.category)} · {request.description}
                      </span>
                    </Td>
                    <Td>{reporter?.full_name ?? "—"}</Td>
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
                    <Td>
                      <StatusBadge status={request.status} />
                    </Td>
                    <Td>
                      <MaintenanceStatusForm requestId={request.id} current={request.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="Nothing open" description="All requests have been resolved." />
        )}
      </Card>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Contractors" className="lg:col-span-1">
          {contractors.data && contractors.data.length > 0 ? (
            <ul className="space-y-3 text-sm">
              {contractors.data.map((contractor) => (
                <li key={contractor.id} className="flex items-center justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-800">
                      {contractor.name}
                    </p>
                    <p className="text-xs text-slate-500">
                      {contractor.trade} · {contractor.phone}
                    </p>
                  </div>
                  {contractor.rating && <Badge tone="brand">{contractor.rating}★</Badge>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="No contractors" description="Add trades to assign work to." />
          )}
        </Card>

        <Card title="Recently closed" className="lg:col-span-2">
          {all.filter((r) => ["closed", "resolved"].includes(r.status)).length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Ref</Th>
                  <Th>Issue</Th>
                  <Th align="right">Cost</Th>
                  <Th>Recharged</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {all
                  .filter((r) => ["closed", "resolved"].includes(r.status))
                  .slice(0, 12)
                  .map((request) => (
                    <tr key={request.id}>
                      <Td>{request.reference}</Td>
                      <Td className="max-w-[14rem] truncate">{request.title}</Td>
                      <Td align="right">
                        {request.actual_cost ? formatMoney(request.actual_cost) : "—"}
                      </Td>
                      <Td>
                        {request.is_tenant_liable ? (
                          <Badge tone="warning">Tenant</Badge>
                        ) : (
                          <Badge>Estate</Badge>
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={request.status} />
                      </Td>
                    </tr>
                  ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="Nothing closed yet" />
          )}
        </Card>
      </div>
    </>
  );
}
