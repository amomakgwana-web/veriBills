import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/domain/money";
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

export const metadata = { title: "Applications" };

export default async function ApplicationsPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const { data: applications } = await supabase
    .from("unit_applications")
    .select(
      `id, reference, status, requested_type, desired_move_in, lease_term_months,
       monthly_income, employer, employment_type, occupants, has_pets, is_company,
       company_name, trading_type, motivation, credit_check_status, credit_score,
       affordability_ratio, created_at,
       profiles!unit_applications_applicant_id_fkey(full_name, email, phone),
       properties(name), units(unit_number, base_rent)`,
    )
    .eq("org_id", orgId)
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = applications ?? [];
  const pending = rows.filter((a) => ["submitted", "screening", "documents_requested"].includes(a.status));

  return (
    <>
      <PageHeader
        title="Applications"
        description="Prospective tenants applying for units, offices and retail space."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-3">
        <StatTile label="Total" value={rows.length} />
        <StatTile label="Awaiting review" value={pending.length} tone={pending.length ? "warning" : "success"} />
        <StatTile
          label="Approved"
          value={rows.filter((a) => a.status === "approved").length}
          tone="success"
        />
      </div>

      <Card>
        {rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Applicant</Th>
                <Th>Looking for</Th>
                <Th align="right">Income</Th>
                <Th align="right">Affordability</Th>
                <Th>Screening</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((application) => {
                const applicant = application.profiles as {
                  full_name: string | null;
                  email: string;
                  phone: string | null;
                } | null;
                const property = application.properties as { name: string } | null;
                const unit = application.units as {
                  unit_number: string;
                  base_rent: number;
                } | null;

                // Rent-to-income is the first thing a letting agent checks.
                const ratio =
                  application.monthly_income && unit?.base_rent
                    ? (Number(unit.base_rent) / Number(application.monthly_income)) * 100
                    : null;

                return (
                  <tr key={application.id}>
                    <Td>{application.reference}</Td>
                    <Td>
                      <span className="font-medium text-slate-800 dark:text-slate-200">
                        {application.is_company
                          ? (application.company_name ?? "Company")
                          : (applicant?.full_name ?? "—")}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {applicant?.email}
                      </span>
                    </Td>
                    <Td>
                      {humanise(application.requested_type)}
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {property?.name ?? "Any property"}
                        {unit ? ` · ${unit.unit_number}` : ""}
                      </span>
                    </Td>
                    <Td align="right">
                      {application.monthly_income ? formatMoney(application.monthly_income) : "—"}
                    </Td>
                    <Td align="right">
                      {ratio !== null ? (
                        <span
                          className={
                            ratio > 33
                              ? "font-medium text-red-600 dark:text-red-400"
                              : "text-emerald-600 dark:text-emerald-400"
                          }
                        >
                          {formatNumber(ratio, 0)}%
                        </span>
                      ) : (
                        "—"
                      )}
                    </Td>
                    <Td>
                      <StatusBadge status={application.credit_check_status} />
                    </Td>
                    <Td>
                      <StatusBadge status={application.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="No applications"
            description="Applications submitted from the tenant portal land here for screening."
          />
        )}
      </Card>
    </>
  );
}
