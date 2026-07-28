import Link from "next/link";

import { requireSession } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { ApplicationForm } from "@/components/tenant/application-form";
import { formatMoney } from "@/lib/domain/money";
import {
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Apply for a unit" };

/**
 * Open to any signed-in user, including people with no tenancy yet, which is
 * the whole point: this is how someone becomes a tenant.
 */
export default async function ApplyPage() {
  const session = await requireSession();
  const supabase = await createClient();

  const [orgs, properties, units, applications] = await Promise.all([
    supabase.from("organisations").select("id, name").eq("is_active", true).order("name"),
    supabase.from("properties").select("id, org_id, name").eq("is_active", true).order("name"),
    supabase
      .from("units")
      .select("id, org_id, property_id, unit_number, type, base_rent, levy_amount, bedrooms, size_sqm")
      .eq("status", "available")
      .order("unit_number"),
    supabase
      .from("unit_applications")
      .select("id, reference, status, requested_type, created_at, decision_reason, properties(name), units(unit_number)")
      .eq("applicant_id", session.userId)
      .order("created_at", { ascending: false }),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <PageHeader
        title="Apply for a unit"
        description="Apartments, offices and retail space currently available."
        action={
          <Link href="/" className="text-brand-700 text-sm font-medium">
            Back to portal
          </Link>
        }
      />

      {applications.data && applications.data.length > 0 && (
        <Card className="mb-5" title="Your applications">
          <TableWrap>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Looking for</Th>
                <Th>Property</Th>
                <Th>Submitted</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {applications.data.map((application) => (
                <tr key={application.id}>
                  <Td>{application.reference}</Td>
                  <Td>{humanise(application.requested_type)}</Td>
                  <Td>
                    {(application.properties as { name: string } | null)?.name ?? "Any"}
                    {(application.units as { unit_number: string } | null)?.unit_number
                      ? ` · ${(application.units as { unit_number: string }).unit_number}`
                      : ""}
                  </Td>
                  <Td>
                    {new Date(application.created_at).toLocaleDateString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      year: "numeric",
                    })}
                  </Td>
                  <Td>
                    <StatusBadge status={application.status} />
                    {application.decision_reason && (
                      <span className="block text-xs text-slate-500">
                        {application.decision_reason}
                      </span>
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Available units">
          {units.data && units.data.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Unit</Th>
                  <Th>Type</Th>
                  <Th align="right">Size</Th>
                  <Th align="right">Rent</Th>
                  <Th align="right">Levy</Th>
                </tr>
              </thead>
              <tbody>
                {units.data.map((unit) => (
                  <tr key={unit.id}>
                    <Td>
                      {unit.unit_number}
                      <span className="block text-xs text-slate-500">
                        {(properties.data ?? []).find((p) => p.id === unit.property_id)?.name}
                      </span>
                    </Td>
                    <Td>{humanise(unit.type)}</Td>
                    <Td align="right">{unit.size_sqm ? `${unit.size_sqm} m²` : "—"}</Td>
                    <Td align="right">{formatMoney(unit.base_rent)}</Td>
                    <Td align="right">{formatMoney(unit.levy_amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="Nothing available right now"
              description="You can still register interest below and the estate will contact you."
            />
          )}
        </Card>

        <Card title="Submit an application">
          <ApplicationForm
            organisations={orgs.data ?? []}
            properties={properties.data ?? []}
            units={units.data ?? []}
          />
        </Card>
      </div>
    </main>
  );
}
