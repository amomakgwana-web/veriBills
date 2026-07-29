import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { MoveStageForm } from "@/components/estate/legal-case-actions";
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

export const metadata = { title: "Legal escalations" };

const STAGE_ORDER = ["intake", "demand", "filed", "court", "resolved"] as const;

const STAGE_TONE: Record<string, "neutral" | "info" | "warning" | "danger" | "success"> = {
  intake: "neutral",
  demand: "info",
  filed: "warning",
  court: "danger",
  resolved: "success",
};

export default async function LegalPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const { data: cases } = await supabase
    .from("legal_cases")
    .select(
      `id, reference, stage, amount, notes, opened_at, resolved_at,
       tenant_accounts(account_number,
         leases(units(unit_number, properties(name)),
                lease_tenants(profile_id, is_primary, profiles(full_name, email))))`,
    )
    .eq("org_id", orgId)
    .order("opened_at", { ascending: false })
    .limit(200);

  const rows = cases ?? [];
  const open = rows.filter((c) => c.stage !== "resolved");
  const inCourt = rows.filter((c) => c.stage === "court");
  const totalValue = open.reduce((sum, c) => sum + Number(c.amount), 0);

  const byStage = STAGE_ORDER.map((stage) => ({
    stage,
    count: rows.filter((c) => c.stage === stage).length,
  }));

  return (
    <>
      <PageHeader title="Legal escalations" description="Matters opened against severely delinquent accounts" />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Open matters" value={open.length} tone={open.length ? "warning" : "success"} />
        <StatTile label="In court" value={inCourt.length} tone={inCourt.length ? "danger" : "success"} />
        <StatTile label="Value at stake" value={formatMoney(totalValue)} tone="danger" />
        <StatTile label="Resolved" value={rows.length - open.length} tone="success" />
      </div>

      <Card className="mb-5" title="By stage">
        <div className="flex flex-wrap gap-2">
          {byStage.map((s) => (
            <Badge key={s.stage} tone={STAGE_TONE[s.stage]}>
              {humanise(s.stage)} · {s.count}
            </Badge>
          ))}
        </div>
      </Card>

      <Card title="Matters">
        {rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Reference</Th>
                <Th>Account</Th>
                <Th align="right">Amount</Th>
                <Th>Opened</Th>
                <Th>Stage</Th>
                <Th>Move</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((legalCase) => {
                const account = legalCase.tenant_accounts as {
                  account_number: string;
                  leases: {
                    units: { unit_number: string; properties: { name: string } | null } | null;
                    lease_tenants: Array<{
                      profile_id: string;
                      is_primary: boolean;
                      profiles: { full_name: string | null; email: string } | null;
                    }>;
                  } | null;
                } | null;

                const lease = account?.leases;
                const primary = lease?.lease_tenants.find((t) => t.is_primary) ?? lease?.lease_tenants[0];

                return (
                  <tr key={legalCase.id}>
                    <Td className="mono">{legalCase.reference}</Td>
                    <Td>
                      {primary?.profiles?.full_name ?? account?.account_number ?? "—"}
                      <span className="block text-xs text-slate-500">
                        {account?.account_number} · {lease?.units?.unit_number}{" "}
                        {lease?.units?.properties?.name}
                      </span>
                    </Td>
                    <Td align="right" className="font-medium text-red-600">
                      {formatMoney(legalCase.amount)}
                    </Td>
                    <Td>
                      {new Date(legalCase.opened_at).toLocaleDateString("en-ZA", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </Td>
                    <Td>
                      <Badge tone={STAGE_TONE[legalCase.stage]}>{humanise(legalCase.stage)}</Badge>
                    </Td>
                    <Td>
                      <MoveStageForm orgId={orgId} caseId={legalCase.id} currentStage={legalCase.stage} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState
            title="No legal matters"
            description="Escalate a severely overdue account from the Arrears page."
          />
        )}
      </Card>
    </>
  );
}
