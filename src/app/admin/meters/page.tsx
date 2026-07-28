import { requireSystemAdmin } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/domain/money";
import { PollMetersButton } from "@/components/admin/poll-meters";
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

export const metadata = { title: "Meters" };

export default async function MetersPage() {
  await requireSystemAdmin();
  const supabase = await createClient();

  const [meters, readings] = await Promise.all([
    supabase
      .from("meters")
      .select(
        "id, meter_number, serial_number, type, vendor, is_bulk, multiplier, last_reading, last_reading_at, installed_on, is_active, units(unit_number), properties(name), tariffs(name)",
      )
      .order("meter_number")
      .limit(200),
    supabase
      .from("meter_readings")
      .select("id, reading, consumption, read_at, source, is_estimate, meters(meter_number)")
      .order("read_at", { ascending: false })
      .limit(30),
  ]);

  const rows = meters.data ?? [];
  // This is an async Server Component: it renders once per request, so reading
  // the clock here is deterministic for that render.
  // eslint-disable-next-line react-hooks/purity
  const staleBefore = Date.now() - 45 * 86400_000;
  const stale = rows.filter(
    (m) =>
      m.is_active &&
      (!m.last_reading_at || new Date(m.last_reading_at).getTime() < staleBefore),
  );

  const vendors = [...new Set(rows.map((m) => m.vendor).filter(Boolean))] as string[];

  return (
    <>
      <PageHeader
        title="Meter integration"
        description="AMI endpoints, last reads and the tariffs each meter bills on."
        action={<PollMetersButton />}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Meters" value={rows.length} />
        <StatTile
          label="Active"
          value={rows.filter((m) => m.is_active).length}
        />
        <StatTile
          label="Stale reads (45d+)"
          value={stale.length}
          tone={stale.length ? "warning" : "success"}
        />
        <StatTile label="Vendors" value={vendors.length} />
      </div>

      <Card title="Meters" className="mb-5">
        {rows.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Meter</Th>
                <Th>Unit</Th>
                <Th>Property</Th>
                <Th>Type</Th>
                <Th>Vendor</Th>
                <Th>Tariff</Th>
                <Th align="right">Last reading</Th>
                <Th>Read at</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((meter) => {
                const isStale = stale.includes(meter);

                return (
                  <tr key={meter.id}>
                    <Td>
                      {meter.meter_number}
                      {meter.is_bulk && (
                        <Badge tone="info" className="ml-1.5">
                          Bulk
                        </Badge>
                      )}
                    </Td>
                    <Td>{(meter.units as { unit_number: string } | null)?.unit_number ?? "—"}</Td>
                    <Td>{(meter.properties as { name: string } | null)?.name ?? "—"}</Td>
                    <Td>{humanise(meter.type)}</Td>
                    <Td>{meter.vendor ? humanise(meter.vendor) : "—"}</Td>
                    <Td>{(meter.tariffs as { name: string } | null)?.name ?? "—"}</Td>
                    <Td align="right">
                      {meter.last_reading !== null ? formatNumber(meter.last_reading, 1) : "—"}
                    </Td>
                    <Td>
                      {meter.last_reading_at ? (
                        <span className={isStale ? "text-red-600" : ""}>
                          {new Date(meter.last_reading_at).toLocaleDateString("en-ZA", {
                            day: "numeric",
                            month: "short",
                            year: "2-digit",
                          })}
                        </span>
                      ) : (
                        <Badge tone="warning">Never</Badge>
                      )}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No meters configured" />
        )}
      </Card>

      <Card title="Recent readings">
        {readings.data && readings.data.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Meter</Th>
                <Th align="right">Reading</Th>
                <Th align="right">Consumption</Th>
                <Th>Source</Th>
                <Th>When</Th>
              </tr>
            </thead>
            <tbody>
              {readings.data.map((reading) => (
                <tr key={reading.id}>
                  <Td>{(reading.meters as { meter_number: string } | null)?.meter_number ?? "—"}</Td>
                  <Td align="right">{formatNumber(reading.reading, 1)}</Td>
                  <Td align="right">{formatNumber(reading.consumption, 2)}</Td>
                  <Td>
                    {humanise(reading.source)}
                    {reading.is_estimate && (
                      <Badge tone="warning" className="ml-1.5">
                        Estimate
                      </Badge>
                    )}
                  </Td>
                  <Td>
                    {new Date(reading.read_at).toLocaleString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No readings captured" />
        )}
      </Card>
    </>
  );
}
