import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Audit trail" };

/** Immutable record of who changed what. Visible to owners and admins only. */
export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string; table?: string }>;
}) {
  const params = await searchParams;
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  let query = supabase
    .from("audit_logs")
    .select("id, action, entity_table, entity_id, occurred_at, actor_id, profiles(full_name, email)")
    .eq("org_id", orgId)
    .order("occurred_at", { ascending: false })
    .limit(150);

  if (params.table) query = query.eq("entity_table", params.table);

  const { data: logs, error } = await query;

  // RLS restricts audit_logs to owners and admins; anything else reads empty.
  if (error) {
    return (
      <>
        <PageHeader title="Audit trail" />
        <Card>
          <EmptyState
            title="Not available"
            description="The audit trail is restricted to estate owners and administrators."
          />
        </Card>
      </>
    );
  }

  const rows = logs ?? [];
  const tables = [...new Set(rows.map((r) => r.entity_table))].sort();

  return (
    <>
      <PageHeader
        title="Audit trail"
        description="Every change to leases, payments, mandates, banking and staff access."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Entries" value={rows.length} />
        <StatTile label="Tables tracked" value={tables.length} />
        <StatTile
          label="Actors"
          value={new Set(rows.map((r) => r.actor_id).filter(Boolean)).size}
        />
      </div>

      {tables.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5">
          <Chip orgId={orgId} label="All" active={!params.table} />
          {tables.map((table) => (
            <Chip
              key={table}
              orgId={orgId}
              table={table}
              label={humanise(table)}
              active={params.table === table}
            />
          ))}
        </div>
      )}

      <Card>
        {rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>When</Th>
                <Th>Actor</Th>
                <Th>Action</Th>
                <Th>Entity</Th>
                <Th>Record</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((log) => {
                const actor = log.profiles as { full_name: string | null; email: string } | null;

                return (
                  <tr key={log.id}>
                    <Td>
                      {new Date(log.occurred_at).toLocaleString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </Td>
                    <Td>{actor?.full_name ?? actor?.email ?? "System"}</Td>
                    <Td>
                      <Badge
                        tone={
                          log.action === "delete"
                            ? "danger"
                            : log.action === "insert"
                              ? "success"
                              : "info"
                        }
                      >
                        {humanise(log.action)}
                      </Badge>
                    </Td>
                    <Td>{humanise(log.entity_table)}</Td>
                    <Td>
                      <code className="text-xs text-slate-500">
                        {log.entity_id?.slice(0, 8) ?? "—"}
                      </code>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="No audit entries"
            description="Changes to tracked records will appear here."
          />
        )}
      </Card>
    </>
  );
}

function Chip({
  orgId,
  table,
  label,
  active,
}: {
  orgId: string;
  table?: string;
  label: string;
  active: boolean;
}) {
  const href = table
    ? `/estate/audit?org=${orgId}&table=${table}`
    : `/estate/audit?org=${orgId}`;

  return (
    <a
      href={href}
      className={
        active
          ? "bg-brand-700 rounded-full px-2.5 py-1 text-xs font-medium text-white"
          : "rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200"
      }
    >
      {label}
    </a>
  );
}
