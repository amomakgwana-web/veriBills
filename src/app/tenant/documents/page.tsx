import { resolveUnit } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Documents" };

/** Documents the estate publishes to tenants, plus the lease itself. */
export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { session, unit } = await resolveUnit(searchParams);
  const supabase = await createClient();

  const [documents, lease, acknowledgements] = await Promise.all([
    supabase
      .from("documents")
      .select("id, type, title, description, storage_path, published_at, requires_acknowledgement, version, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("leases")
      .select("id, reference, status, start_date, end_date, monthly_rent, monthly_levy, deposit_held, escalation_percent, signed_at")
      .eq("id", unit.leaseId)
      .maybeSingle(),
    supabase.from("document_acknowledgements").select("document_id").eq("profile_id", session.userId),
  ]);

  const acked = new Set((acknowledgements.data ?? []).map((a) => a.document_id));

  const leaseDocs = (documents.data ?? []).filter((d) =>
    ["signed_lease", "unsigned_lease"].includes(d.type),
  );
  const policyDocs = (documents.data ?? []).filter((d) =>
    ["estate_policy", "house_rules", "notice"].includes(d.type),
  );
  const personalDocs = (documents.data ?? []).filter(
    (d) => !leaseDocs.includes(d) && !policyDocs.includes(d),
  );

  return (
    <>
      <PageHeader
        title="My documents"
        description={`Unit ${unit.unitNumber} · lease, estate policies and your uploads`}
      />

      {lease.data && (
        <Card className="mb-5" title="Lease summary" description={lease.data.reference}>
          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Detail label="Status" value={humanise(lease.data.status)} />
            <Detail
              label="Term"
              value={`${new Date(lease.data.start_date).toLocaleDateString("en-ZA", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })} – ${
                lease.data.end_date
                  ? new Date(lease.data.end_date).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "open"
              }`}
            />
            <Detail label="Escalation" value={`${lease.data.escalation_percent}% a year`} />
            <Detail
              label="Signed"
              value={
                lease.data.signed_at
                  ? new Date(lease.data.signed_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })
                  : "Not signed"
              }
            />
          </dl>
        </Card>
      )}

      <div className="space-y-5">
        <DocumentSection title="Lease documents" documents={leaseDocs} acked={acked} />
        <DocumentSection title="Estate policies and rules" documents={policyDocs} acked={acked} />
        <DocumentSection title="Supporting documents" documents={personalDocs} acked={acked} />
      </div>
    </>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium text-slate-800 dark:text-slate-200">{value}</dd>
    </div>
  );
}

function DocumentSection({
  title,
  documents,
  acked,
}: {
  title: string;
  documents: Array<{
    id: string;
    type: string;
    title: string;
    description: string | null;
    version: number;
    created_at: string;
    requires_acknowledgement: boolean;
  }>;
  acked: Set<string>;
}) {
  return (
    <Card title={title}>
      {documents.length > 0 ? (
        <TableWrap>
          <thead>
            <tr>
              <Th>Document</Th>
              <Th>Type</Th>
              <Th>Version</Th>
              <Th>Added</Th>
              <Th>Acknowledgement</Th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <Td>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{doc.title}</span>
                  {doc.description && (
                    <span className="block text-xs text-slate-500 dark:text-slate-400">
                      {doc.description}
                    </span>
                  )}
                </Td>
                <Td>{humanise(doc.type)}</Td>
                <Td>v{doc.version}</Td>
                <Td>
                  {new Date(doc.created_at).toLocaleDateString("en-ZA", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </Td>
                <Td>
                  {doc.requires_acknowledgement ? (
                    acked.has(doc.id) ? (
                      <Badge tone="success">Acknowledged</Badge>
                    ) : (
                      <Badge tone="warning">Action needed</Badge>
                    )
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      ) : (
        <EmptyState title="Nothing here yet" />
      )}
    </Card>
  );
}
