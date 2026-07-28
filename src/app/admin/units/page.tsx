import { requireSystemAdmin } from "@/lib/auth/session";
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

export const metadata = { title: "Unit configuration" };

/** Rents, levies, deposits and the tariffs each unit is billed on. */
export default async function UnitConfigPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const [units, tariffs] = await Promise.all([
    supabase
      .from("units")
      .select(
        `id, unit_number, type, status, bedrooms, size_sqm, parking_bays,
         base_rent, levy_amount, refuse_amount, security_amount, deposit_amount,
         properties(name, organisations(name)),
         water_tariff:tariffs!units_water_tariff_fk(name),
         electricity_tariff:tariffs!units_electricity_tariff_fk(name)`,
      )
      .order("unit_number")
      .limit(200),
    supabase
      .from("tariffs")
      .select(
        "id, name, utility, fixed_charge, vat_rate, markup_percent, effective_from, is_active, organisations(name), tariff_blocks(sequence, block_from_units, block_to_units, rate_per_unit)",
      )
      .order("name"),
  ]);

  const rows = units.data ?? [];
  const monthlyRoll = rows.reduce(
    (sum, u) => sum + Number(u.base_rent) + Number(u.levy_amount),
    0,
  );

  return (
    <>
      <PageHeader
        title="Unit configuration"
        description="Rent, levies and the tariffs that drive each unit's bill."
      />

      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <StatTile label="Units" value={rows.length} />
        <StatTile
          label="Occupied"
          value={rows.filter((u) => u.status === "occupied").length}
        />
        <StatTile label="Monthly roll" value={formatMoney(monthlyRoll)} />
        <StatTile label="Tariffs" value={tariffs.data?.length ?? 0} />
      </div>

      <Card title="Units" className="mb-5">
        {rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Unit</Th>
                <Th>Property</Th>
                <Th>Type</Th>
                <Th align="right">Rent</Th>
                <Th align="right">Levy</Th>
                <Th align="right">Refuse</Th>
                <Th align="right">Security</Th>
                <Th align="right">Deposit</Th>
                <Th>Water tariff</Th>
                <Th>Electricity tariff</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((unit) => {
                const property = unit.properties as {
                  name: string;
                  organisations: { name: string } | null;
                } | null;

                return (
                  <tr key={unit.id}>
                    <Td>{unit.unit_number}</Td>
                    <Td>
                      {property?.name}
                      <span className="block text-xs text-slate-500">
                        {property?.organisations?.name}
                      </span>
                    </Td>
                    <Td>{humanise(unit.type)}</Td>
                    <Td align="right">{formatMoney(unit.base_rent)}</Td>
                    <Td align="right">{formatMoney(unit.levy_amount)}</Td>
                    <Td align="right">{formatMoney(unit.refuse_amount)}</Td>
                    <Td align="right">{formatMoney(unit.security_amount)}</Td>
                    <Td align="right">{formatMoney(unit.deposit_amount)}</Td>
                    <Td>{(unit.water_tariff as { name: string } | null)?.name ?? "—"}</Td>
                    <Td>{(unit.electricity_tariff as { name: string } | null)?.name ?? "—"}</Td>
                    <Td>
                      <StatusBadge status={unit.status} />
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No units configured" />
        )}
      </Card>

      <Card title="Tariffs" description="Stepped block rates applied to metered consumption.">
        {tariffs.data && tariffs.data.length > 0 ? (
          <div className="space-y-5">
            {tariffs.data.map((tariff) => {
              const blocks = [...(tariff.tariff_blocks ?? [])].sort(
                (a, b) => a.sequence - b.sequence,
              );

              return (
                <div
                  key={tariff.id}
                  className="rounded-lg border border-slate-200 p-4"
                >
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">
                        {tariff.name}
                      </p>
                      <p className="text-xs text-slate-500">
                        {humanise(tariff.utility)} ·{" "}
                        {(tariff.organisations as { name: string } | null)?.name} · fixed{" "}
                        {formatMoney(tariff.fixed_charge)} · markup {tariff.markup_percent}% · VAT{" "}
                        {(Number(tariff.vat_rate) * 100).toFixed(0)}%
                      </p>
                    </div>
                    <StatusBadge status={tariff.is_active ? "active" : "inactive"} />
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
                            {block.block_to_units === null
                              ? "∞"
                              : formatNumber(block.block_to_units, 0)}
                          </Td>
                          <Td align="right">
                            R{formatNumber(block.rate_per_unit, 4)}
                          </Td>
                        </tr>
                      ))}
                    </tbody>
                  </TableWrap>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState title="No tariffs configured" />
        )}
      </Card>
    </>
  );
}
