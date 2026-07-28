import Link from "next/link";

import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { hasServiceRole } from "@/lib/supabase/admin";
import { integrationStatus } from "@/lib/integrations";
import { formatMoney, formatNumber } from "@/lib/domain/money";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

export const metadata = { title: "Platform overview" };

export default async function AdminOverview() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);

  // The system admin bypasses org scoping in RLS, so these are platform-wide.
  const [orgs, properties, units, accounts, payments, purchases, deliveries, tenants] =
    await Promise.all([
      supabase.from("organisations").select("id, name, slug, is_active, created_at"),
      supabase.from("properties").select("id, org_id, is_active"),
      supabase.from("units").select("id, status"),
      supabase.from("tenant_accounts").select("id, balance, is_in_arrears"),
      supabase
        .from("payments")
        .select("id, amount, status, method")
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("electricity_purchases")
        .select("id, gross_amount, units_kwh, status")
        .gte("created_at", monthStart.toISOString()),
      supabase
        .from("message_deliveries")
        .select("id, channel, status")
        .gte("created_at", monthStart.toISOString()),
      supabase.from("lease_tenants").select("profile_id"),
    ]);

  const orgRows = orgs.data ?? [];
  const totalOwed = (accounts.data ?? []).reduce(
    (sum, a) => sum + Math.max(Number(a.balance), 0),
    0,
  );

  const processed = (payments.data ?? [])
    .filter((p) => ["captured", "settled"].includes(p.status))
    .reduce((sum, p) => sum + Number(p.amount), 0);

  const tokensSold = (purchases.data ?? []).filter((p) =>
    ["token_issued", "delivered"].includes(p.status),
  );

  const occupied = (units.data ?? []).filter((u) => u.status === "occupied").length;
  const uniqueTenants = new Set((tenants.data ?? []).map((t) => t.profile_id)).size;

  const deliveryFailed = (deliveries.data ?? []).filter((d) =>
    ["failed", "bounced"].includes(d.status),
  ).length;

  const providers = integrationStatus();
  const mockCount = providers.filter((p) => p.isMock).length;

  return (
    <>
      <PageHeader
        title="Platform overview"
        description="Every organisation, property and transaction on veriBills."
      />

      {!hasServiceRole() && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/40">
          <p className="text-sm font-medium text-red-900 dark:text-red-200">
            Service role key not configured
          </p>
          <p className="mt-0.5 text-sm text-red-800 dark:text-red-300">
            Billing runs, payment settlement and prepaid token issue are disabled until{" "}
            <code>SUPABASE_SERVICE_ROLE_KEY</code> is set on the server.
          </p>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Organisations" value={orgRows.length} href="/admin/organisations" />
        <StatTile
          label="Properties"
          value={(properties.data ?? []).filter((p) => p.is_active).length}
        />
        <StatTile
          label="Units"
          value={units.data?.length ?? 0}
          hint={`${occupied} occupied`}
        />
        <StatTile label="Tenants" value={uniqueTenants} />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Processed this month"
          value={formatMoney(processed)}
          hint={`${payments.data?.length ?? 0} payments`}
        />
        <StatTile label="Book value outstanding" value={formatMoney(totalOwed)} tone="danger" />
        <StatTile
          label="Prepaid electricity"
          value={`${formatNumber(
            tokensSold.reduce((s, p) => s + Number(p.units_kwh ?? 0), 0),
            0,
          )} kWh`}
          hint={formatMoney(tokensSold.reduce((s, p) => s + Number(p.gross_amount), 0))}
        />
        <StatTile
          label="Messages"
          value={deliveries.data?.length ?? 0}
          hint={`${deliveryFailed} failed`}
          tone={deliveryFailed > 0 ? "warning" : "success"}
          href="/admin/deliveries"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card
          title="Integration providers"
          description={
            mockCount > 0
              ? `${mockCount} of ${providers.length} running against mocks.`
              : "All providers configured."
          }
          action={
            <Link href="/admin/integrations" className="text-brand-700 dark:text-brand-400 text-xs font-medium">
              Configure
            </Link>
          }
        >
          <TableWrap>
            <thead>
              <tr>
                <Th>Provider</Th>
                <Th>Configured</Th>
                <Th>Active</Th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr key={provider.label}>
                  <Td>{provider.label}</Td>
                  <Td>{provider.configured}</Td>
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

        <Card
          title="Organisations"
          action={
            <Link href="/admin/organisations" className="text-brand-700 dark:text-brand-400 text-xs font-medium">
              View all
            </Link>
          }
        >
          {orgRows.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Slug</Th>
                  <Th align="right">Properties</Th>
                  <Th>Status</Th>
                </tr>
              </thead>
              <tbody>
                {orgRows.map((org) => (
                  <tr key={org.id}>
                    <Td>{org.name}</Td>
                    <Td>
                      <code className="text-xs text-slate-500">{org.slug}</code>
                    </Td>
                    <Td align="right">
                      {(properties.data ?? []).filter((p) => p.org_id === org.id).length}
                    </Td>
                    <Td>
                      <Badge tone={org.is_active ? "success" : "neutral"}>
                        {org.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState title="No organisations yet" />
          )}
        </Card>
      </div>
    </>
  );
}
