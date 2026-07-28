import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
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

export const metadata = { title: "Organisations" };

export default async function OrganisationsPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const [orgs, properties, members, accounts, banks] = await Promise.all([
    supabase
      .from("organisations")
      .select(
        "id, name, trading_name, slug, registration_no, vat_number, billing_email, support_phone, city, province, currency_code, is_active, created_at",
      )
      .order("name"),
    supabase.from("properties").select("id, org_id, name, type, is_active"),
    supabase
      .from("org_members")
      .select("org_id, role, is_active, profiles!org_members_profile_id_fkey(full_name, email)"),
    supabase.from("tenant_accounts").select("org_id, balance"),
    supabase
      .from("bank_accounts")
      .select("id, org_id, label, bank_name, account_number_masked, is_primary, verified_at, pending_approval_id"),
  ]);

  return (
    <>
      <PageHeader
        title="Organisations"
        description="Every estate group, landlord entity and managing agent on the platform."
      />

      <div className="space-y-5">
        {(orgs.data ?? []).map((org) => {
          const orgProperties = (properties.data ?? []).filter((p) => p.org_id === org.id);
          const orgMembers = (members.data ?? []).filter((m) => m.org_id === org.id);
          const owed = (accounts.data ?? [])
            .filter((a) => a.org_id === org.id)
            .reduce((sum, a) => sum + Math.max(Number(a.balance), 0), 0);
          const orgBanks = (banks.data ?? []).filter((b) => b.org_id === org.id);

          return (
            <Card
              key={org.id}
              title={org.name}
              description={`${org.slug} · Reg ${org.registration_no ?? "—"} · VAT ${org.vat_number ?? "—"}`}
              action={
                <Badge tone={org.is_active ? "success" : "neutral"}>
                  {org.is_active ? "Active" : "Inactive"}
                </Badge>
              }
            >
              <div className="grid gap-5 lg:grid-cols-3">
                <div>
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Details
                  </h3>
                  <dl className="space-y-1.5 text-sm">
                    <Row label="Billing email">{org.billing_email ?? "—"}</Row>
                    <Row label="Support">{org.support_phone ?? "—"}</Row>
                    <Row label="Location">
                      {[org.city, org.province].filter(Boolean).join(", ") || "—"}
                    </Row>
                    <Row label="Currency">{org.currency_code}</Row>
                    <Row label="Outstanding">{formatMoney(owed)}</Row>
                  </dl>
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Properties ({orgProperties.length})
                  </h3>
                  {orgProperties.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {orgProperties.map((property) => (
                        <li key={property.id} className="flex items-center justify-between gap-2">
                          <span className="text-slate-700 dark:text-slate-300">{property.name}</span>
                          <Badge>{humanise(property.type)}</Badge>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No properties</p>
                  )}

                  <h3 className="mt-4 mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Banking
                  </h3>
                  {orgBanks.length > 0 ? (
                    <ul className="space-y-1.5 text-sm">
                      {orgBanks.map((bank) => (
                        <li key={bank.id} className="flex items-center justify-between gap-2">
                          <span className="text-slate-700 dark:text-slate-300">
                            {bank.bank_name} {bank.account_number_masked}
                          </span>
                          {bank.pending_approval_id ? (
                            <Badge tone="warning">Change pending</Badge>
                          ) : bank.verified_at ? (
                            <Badge tone="success">Verified</Badge>
                          ) : (
                            <Badge>Unverified</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      No bank account configured
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-xs font-medium tracking-wide text-slate-500 uppercase dark:text-slate-400">
                    Staff ({orgMembers.length})
                  </h3>
                  {orgMembers.length > 0 ? (
                    <TableWrap>
                      <thead>
                        <tr>
                          <Th>Name</Th>
                          <Th>Role</Th>
                        </tr>
                      </thead>
                      <tbody>
                        {orgMembers.map((member, i) => {
                          const profile = member.profiles as {
                            full_name: string | null;
                            email: string;
                          } | null;
                          return (
                            <tr key={i}>
                              <Td>
                                {profile?.full_name ?? profile?.email ?? "—"}
                                <span className="block text-xs text-slate-500">
                                  {profile?.email}
                                </span>
                              </Td>
                              <Td>
                                <Badge tone={member.role === "owner" ? "brand" : "neutral"}>
                                  {humanise(member.role)}
                                </Badge>
                              </Td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </TableWrap>
                  ) : (
                    <p className="text-sm text-slate-500 dark:text-slate-400">No staff</p>
                  )}
                </div>
              </div>
            </Card>
          );
        })}

        {(orgs.data?.length ?? 0) === 0 && (
          <Card>
            <EmptyState title="No organisations" description="Onboard your first estate." />
          </Card>
        )}
      </div>
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="text-right font-medium text-slate-800 dark:text-slate-200">{children}</dd>
    </div>
  );
}
