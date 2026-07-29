import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/domain/money";
import { NewTariffForm, EditBlocksForm, TariffActiveToggle } from "@/components/admin/tariff-forms";
import { Card, EmptyState, PageHeader, StatTile, StatusBadge, TableWrap, Td, Th, humanise } from "@/components/ui";

export const metadata = { title: "Tariffs" };

export default async function TariffsPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const [orgsResult, tariffsResult] = await Promise.all([
    supabase.from("organisations").select("id, name").order("name"),
    supabase
      .from("tariffs")
      .select(
        "id, name, utility, fixed_charge, vat_rate, markup_percent, effective_from, is_active, organisations(name), tariff_blocks(sequence, block_from_units, block_to_units, rate_per_unit)",
      )
      .order("utility")
      .order("name"),
  ]);

  const orgs = orgsResult.data ?? [];
  const tariffs = tariffsResult.data ?? [];
  const water = tariffs.filter((t) => t.utility === "water");
  const electricity = tariffs.filter((t) => t.utility !== "water");

  return (
    <>
      <PageHeader
        title="Tariffs"
        description="Stepped block rates for water and electricity, applied per organisation."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Tariffs" value={tariffs.length} />
        <StatTile label="Active" value={tariffs.filter((t) => t.is_active).length} />
        <StatTile label="Water" value={water.length} />
        <StatTile label="Electricity" value={electricity.length} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card title="New tariff" description="Create a stepped rate for water or electricity.">
            <NewTariffForm orgs={orgs} />
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          {tariffs.length > 0 ? (
            tariffs.map((tariff) => {
              const blocks = [...(tariff.tariff_blocks ?? [])].sort((a, b) => a.sequence - b.sequence);

              return (
                <Card key={tariff.id}>
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{tariff.name}</p>
                      <p className="text-xs text-slate-500">
                        {humanise(tariff.utility)} · {(tariff.organisations as { name: string } | null)?.name} ·
                        fixed {formatMoney(tariff.fixed_charge)} · markup {tariff.markup_percent}% · VAT{" "}
                        {(Number(tariff.vat_rate) * 100).toFixed(0)}% · from{" "}
                        {new Date(tariff.effective_from).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "numeric",
                        })}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={tariff.is_active ? "active" : "inactive"} />
                      <TariffActiveToggle tariffId={tariff.id} isActive={tariff.is_active} />
                    </div>
                  </div>

                  <TableWrap>
                    <thead>
                      <tr>
                        <Th>Block</Th>
                        <Th align="right">From</Th>
                        <Th align="right">To</Th>
                        <Th align="right">Rate per unit</Th>
                      </tr>
                    </thead>
                    <tbody>
                      {blocks.map((block) => (
                        <tr key={block.sequence}>
                          <Td>{block.sequence}</Td>
                          <Td align="right">{formatNumber(block.block_from_units, 0)}</Td>
                          <Td align="right">
                            {block.block_to_units === null ? "∞" : formatNumber(block.block_to_units, 0)}
                          </Td>
                          <Td align="right">R{formatNumber(block.rate_per_unit, 4)}</Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>

                  <EditBlocksForm
                    tariffId={tariff.id}
                    initialBlocks={blocks.map((b) => ({
                      from: String(b.block_from_units),
                      to: b.block_to_units === null ? "" : String(b.block_to_units),
                      rate: String(b.rate_per_unit),
                    }))}
                  />
                </Card>
              );
            })
          ) : (
            <Card>
              <EmptyState title="No tariffs configured" description="Create the first one on the left." />
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
