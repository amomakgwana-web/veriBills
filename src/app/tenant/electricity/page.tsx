import { resolveUnit } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney, formatNumber } from "@/lib/domain/money";
import { BuyElectricityForm } from "@/components/tenant/buy-electricity";
import {
  Card,
  EmptyState,
  PageHeader,
  StatTile,
  StatusBadge,
  TableWrap,
  Td,
  Th,
} from "@/components/ui";

export const metadata = { title: "Electricity" };

export default async function ElectricityPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit } = await resolveUnit(searchParams);
  const supabase = await createClient();

  const [meters, purchases] = await Promise.all([
    supabase
      .from("meters")
      .select(
        "id, meter_number, type, last_reading, last_reading_at, tariff_id, tariffs(name, fixed_charge, vat_rate, markup_percent, tariff_blocks(sequence, block_from_units, block_to_units, rate_per_unit))",
      )
      .eq("unit_id", unit.unitId)
      .eq("is_active", true),
    supabase
      .from("electricity_purchases")
      .select("id, reference, gross_amount, units_kwh, token, status, created_at, debt_recovered")
      .eq("unit_id", unit.unitId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const prepaidMeters = (meters.data ?? []).filter((m) => m.type === "electricity_prepaid");

  const totals = (purchases.data ?? []).reduce(
    (acc, p) => {
      if (p.status === "token_issued" || p.status === "delivered") {
        acc.units += Number(p.units_kwh ?? 0);
        acc.spend += Number(p.gross_amount ?? 0);
      }
      return acc;
    },
    { units: 0, spend: 0 },
  );

  const last = purchases.data?.[0];

  return (
    <>
      <PageHeader
        title="Prepaid electricity"
        description={`Unit ${unit.unitNumber} · ${unit.propertyName}`}
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <StatTile label="Purchased (last 20)" value={`${formatNumber(totals.units, 1)} kWh`} />
        <StatTile label="Spent" value={formatMoney(totals.spend)} />
        <StatTile
          label="Last token"
          value={last?.units_kwh ? `${formatNumber(last.units_kwh, 1)} kWh` : "—"}
          hint={
            last
              ? new Date(last.created_at).toLocaleDateString("en-ZA", {
                  day: "numeric",
                  month: "short",
                })
              : "No purchases yet"
          }
        />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card title="Buy electricity">
            {prepaidMeters.length > 0 ? (
              <BuyElectricityForm
                meters={prepaidMeters.map((m) => ({
                  id: m.id,
                  meterNumber: m.meter_number,
                  tariff: m.tariffs
                    ? {
                        name: m.tariffs.name,
                        fixed_charge: m.tariffs.fixed_charge,
                        vat_rate: m.tariffs.vat_rate,
                        markup_percent: m.tariffs.markup_percent,
                        blocks: m.tariffs.tariff_blocks ?? [],
                      }
                    : null,
                }))}
              />
            ) : (
              <EmptyState
                title="No prepaid meter on this unit"
                description="This unit is billed on a conventional meter, so electricity appears on your monthly invoice instead."
              />
            )}
          </Card>
        </div>

        <div className="lg:col-span-2">
          <Card title="Purchase history">
            {purchases.data && purchases.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Date</Th>
                    <Th align="right">Amount</Th>
                    <Th align="right">Units</Th>
                    <Th>Token</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {purchases.data.map((purchase) => (
                    <tr key={purchase.id}>
                      <Td>
                        {new Date(purchase.created_at).toLocaleDateString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          year: "2-digit",
                        })}
                      </Td>
                      <Td align="right">{formatMoney(purchase.gross_amount)}</Td>
                      <Td align="right">{formatNumber(purchase.units_kwh, 2)}</Td>
                      <Td>
                        {purchase.token ? (
                          <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs tracking-wider">
                            {purchase.token}
                          </code>
                        ) : (
                          "—"
                        )}
                      </Td>
                      <Td>
                        <StatusBadge status={purchase.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No purchases yet"
                description="Buy your first units and the token will appear here and by SMS."
              />
            )}
          </Card>

          {(meters.data?.length ?? 0) > 0 && (
            <Card className="mt-5" title="Meters on this unit">
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Meter</Th>
                    <Th>Type</Th>
                    <Th>Tariff</Th>
                    <Th align="right">Last reading</Th>
                  </tr>
                </thead>
                <tbody>
                  {meters.data!.map((meter) => (
                    <tr key={meter.id}>
                      <Td>{meter.meter_number}</Td>
                      <Td>{meter.type.replace(/_/g, " ")}</Td>
                      <Td>{meter.tariffs?.name ?? "—"}</Td>
                      <Td align="right">
                        {meter.last_reading !== null ? formatNumber(meter.last_reading, 1) : "—"}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
