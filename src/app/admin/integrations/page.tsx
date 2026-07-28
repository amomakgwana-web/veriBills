import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { integrationStatus } from "@/lib/integrations";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Integrations" };

const KIND_LABELS: Record<string, string> = {
  payment_gateway: "Card acquiring and 3-D Secure",
  sms_gateway: "SMS delivery",
  email_gateway: "Transactional and bulk email",
  meter_vendor: "AMI meter reads",
  token_vendor: "Prepaid electricity token vending",
  accounting: "General ledger export",
  bank_feed: "Bank statement import for reconciliation",
  identity_verification: "Applicant identity and credit checks",
};

export default async function IntegrationsPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const [integrations, vendors, exports] = await Promise.all([
    supabase
      .from("integrations")
      .select(
        "id, kind, provider, name, status, is_sandbox, credential_ref, last_success_at, last_failure_at, last_error, organisations(name)",
      )
      .order("kind"),
    supabase
      .from("token_vendors")
      .select("id, key, name, is_default, is_active, credential_ref, organisations(name)"),
    supabase
      .from("accounting_exports")
      .select("id, period_start, period_end, status, entry_count, total_debit, total_credit, external_reference, organisations(name)")
      .order("created_at", { ascending: false })
      .limit(15),
  ]);

  const providers = integrationStatus();

  return (
    <>
      <PageHeader
        title="Integrations"
        description="External services the platform depends on."
      />

      <Card
        className="mb-5"
        title="Runtime providers"
        description="Resolved from environment variables at request time. Each falls back to a working mock so the platform runs without third-party credentials."
      >
        <TableWrap>
          <thead>
            <tr>
              <Th>Capability</Th>
              <Th>Environment value</Th>
              <Th>Active implementation</Th>
              <Th>Mode</Th>
            </tr>
          </thead>
          <tbody>
            {providers.map((provider) => (
              <tr key={provider.label}>
                <Td>{provider.label}</Td>
                <Td>
                  <code className="text-xs text-slate-500">{provider.configured}</code>
                </Td>
                <Td>{provider.active}</Td>
                <Td>
                  <Badge tone={provider.isMock ? "warning" : "success"}>
                    {provider.isMock ? "Mock" : "Live"}
                  </Badge>
                </Td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Credentials are read from the environment and never stored in the database. Integration
          records below hold only non-secret configuration plus a reference to the secret store.
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Configured integrations">
          {integrations.data && integrations.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Kind</Th>
                  <Th>Provider</Th>
                  <Th>Organisation</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {integrations.data.map((integration) => (
                  <tr key={integration.id}>
                    <Td>
                      {humanise(integration.kind)}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {KIND_LABELS[integration.kind] ?? ""}
                      </span>
                    </Td>
                    <Td>
                      {integration.provider}
                      {integration.is_sandbox && (
                        <Badge tone="warning" className="ml-1.5">
                          Sandbox
                        </Badge>
                      )}
                    </Td>
                    <Td>
                      {(integration.organisations as { name: string } | null)?.name ?? "Platform"}
                    </Td>
                    <Td>
                      <StatusBadge status={integration.status} />
                      {integration.last_error && (
                        <span className="block text-xs text-red-500">{integration.last_error}</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No integrations recorded"
              description="Providers currently resolve from environment variables only."
            />
          )}
        </Card>

        <Card title="Electricity token vendors" description="Eskom and partner vending endpoints.">
          {vendors.data && vendors.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Key</Th>
                  <Th>Name</Th>
                  <Th>Organisation</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {vendors.data.map((vendor) => (
                  <tr key={vendor.id}>
                    <Td>
                      <code className="text-xs">{vendor.key}</code>
                    </Td>
                    <Td>{vendor.name}</Td>
                    <Td>{(vendor.organisations as { name: string } | null)?.name ?? "Platform"}</Td>
                    <Td>
                      {vendor.is_default && <Badge tone="brand">Default</Badge>}
                      <Badge tone={vendor.is_active ? "success" : "neutral"}>
                        {vendor.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No token vendors configured"
              description="Prepaid purchases currently use the built-in mock vendor."
            />
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title="Accounting exports"
          description="Journals pushed to the estate's accounting platform."
        >
          {exports.data && exports.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Organisation</Th>
                  <Th>Period</Th>
                  <Th align="right">Entries</Th>
                  <Th align="right">Debit</Th>
                  <Th align="right">Credit</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {exports.data.map((entry) => (
                  <tr key={entry.id}>
                    <Td>{(entry.organisations as { name: string } | null)?.name ?? "—"}</Td>
                    <Td>
                      {new Date(entry.period_start).toLocaleDateString("en-ZA", {
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                    <Td align="right">{entry.entry_count}</Td>
                    <Td align="right">{entry.total_debit}</Td>
                    <Td align="right">{entry.total_credit}</Td>
                    <Td>
                      <StatusBadge status={entry.status} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No exports yet"
              description="Ledger entries are export-ready; connect an accounting provider to push them."
            />
          )}
        </Card>
      </div>
    </>
  );
}
