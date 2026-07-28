import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { CollectionRunForm } from "@/components/estate/collection-run-form";
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

export const metadata = { title: "Collections" };

export default async function CollectionsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [mandates, runs, collections] = await Promise.all([
    supabase
      .from("debicheck_mandates")
      .select(
        "id, contract_reference, status, instalment_amount, maximum_amount, collection_day, bank_name, account_number_masked, authentication_type, profiles(full_name)",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("collection_runs")
      .select("id, action_date, status, mandate_count, total_amount, successful_count, failed_count, completed_at")
      .eq("org_id", orgId)
      .order("action_date", { ascending: false })
      .limit(10),
    supabase
      .from("collections")
      .select(
        "id, status, amount, action_date, response_code, response_reason, debicheck_mandates(contract_reference, profiles(full_name))",
      )
      .eq("org_id", orgId)
      .order("action_date", { ascending: false })
      .limit(40),
  ]);

  const active = (mandates.data ?? []).filter((m) =>
    ["active", "authenticated"].includes(m.status),
  );
  const pending = (mandates.data ?? []).filter((m) => m.status === "pending_authentication");
  const failed = (collections.data ?? []).filter((c) => c.status === "failed");

  const monthlyValue = active.reduce((sum, m) => sum + Number(m.instalment_amount), 0);

  return (
    <>
      <PageHeader
        title="DebiCheck collections"
        description="Authenticated mandates and collection runs"
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Active mandates" value={active.length} tone="success" />
        <StatTile label="Awaiting authentication" value={pending.length} tone={pending.length ? "warning" : "neutral"} />
        <StatTile label="Monthly value" value={formatMoney(monthlyValue)} />
        <StatTile label="Failed collections" value={failed.length} tone={failed.length ? "danger" : "success"} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <Card title="Run a collection" description="Submits every authenticated mandate for the date.">
          <CollectionRunForm orgId={orgId} mandateCount={active.length} />
        </Card>

        <div className="space-y-5 lg:col-span-2">
          <Card title="Collection runs">
            {runs.data && runs.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Action date</Th>
                    <Th align="right">Mandates</Th>
                    <Th align="right">Successful</Th>
                    <Th align="right">Failed</Th>
                    <Th align="right">Collected</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.map((run) => (
                    <tr key={run.id}>
                      <Td>
                        {new Date(run.action_date).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </Td>
                      <Td align="right">{run.mandate_count}</Td>
                      <Td align="right" className="text-brand-600">
                        {run.successful_count}
                      </Td>
                      <Td align="right" className="text-red-600">
                        {run.failed_count}
                      </Td>
                      <Td align="right">{formatMoney(run.total_amount)}</Td>
                      <Td>
                        <StatusBadge status={run.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No collection runs yet" />
            )}
          </Card>

          <Card title="Mandates">
            {mandates.data && mandates.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Contract</Th>
                    <Th>Debtor</Th>
                    <Th>Bank</Th>
                    <Th align="right">Instalment</Th>
                    <Th>Day</Th>
                    <Th>Auth</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {mandates.data.map((mandate) => (
                    <tr key={mandate.id}>
                      <Td>{mandate.contract_reference}</Td>
                      <Td>{(mandate.profiles as { full_name: string | null } | null)?.full_name ?? "—"}</Td>
                      <Td>
                        {mandate.bank_name}
                        <span className="block text-xs text-slate-500">
                          {mandate.account_number_masked}
                        </span>
                      </Td>
                      <Td align="right">{formatMoney(mandate.instalment_amount)}</Td>
                      <Td>{mandate.collection_day}</Td>
                      <Td>{mandate.authentication_type}</Td>
                      <Td>
                        <StatusBadge status={mandate.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No mandates"
                description="Set one up from a tenant's page to collect automatically."
              />
            )}
          </Card>

          <Card title="Recent collections">
            {collections.data && collections.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th>Debtor</Th>
                    <Th align="right">Amount</Th>
                    <Th>Response</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {collections.data.map((collection) => {
                    const mandate = collection.debicheck_mandates as {
                      contract_reference: string;
                      profiles: { full_name: string | null } | null;
                    } | null;

                    return (
                      <tr key={collection.id}>
                        <Td>
                          {new Date(collection.action_date).toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                          })}
                        </Td>
                        <Td>{mandate?.profiles?.full_name ?? mandate?.contract_reference ?? "—"}</Td>
                        <Td align="right">{formatMoney(collection.amount)}</Td>
                        <Td>
                          {collection.response_reason ? (
                            <span className="text-xs">
                              {collection.response_code} · {humanise(collection.response_reason)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </Td>
                        <Td>
                          <StatusBadge status={collection.status} />
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No collections yet" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
