import { resolveOrg } from "@/lib/estate-context";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/domain/money";
import { AcknowledgeAlertButton } from "@/components/estate/acknowledge-alert";
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

export const metadata = { title: "Usage monitoring" };

export default async function UsagePage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const { membership } = await resolveOrg(searchParams);
  const orgId = membership.orgId;
  const supabase = await createClient();

  const [alerts, baselines, rules, readings] = await Promise.all([
    supabase
      .from("usage_alerts")
      .select(
        "id, title, detail, severity, utility, rule, observed_value, expected_value, deviation_percent, is_acknowledged, created_at, units(unit_number, properties(name))",
      )
      .eq("org_id", orgId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("usage_baselines")
      .select("id, utility, mean_consumption, peak_consumption, sample_count, units(unit_number)")
      .eq("org_id", orgId)
      .limit(50),
    supabase
      .from("usage_rules")
      .select("id, utility, rule, spike_percent, absolute_threshold, severity, is_active")
      .eq("org_id", orgId),
    supabase
      .from("meter_readings")
      .select("id, reading, consumption, read_at, source, meters(meter_number, type, units(unit_number))")
      .eq("org_id", orgId)
      .order("read_at", { ascending: false })
      .limit(25),
  ]);

  const open = (alerts.data ?? []).filter((a) => !a.is_acknowledged);
  const critical = open.filter((a) => a.severity === "critical");

  return (
    <>
      <PageHeader
        title="Usage monitoring"
        description="Consumption anomalies flagged against each unit's own baseline."
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-4">
        <StatTile label="Open flags" value={open.length} tone={open.length ? "warning" : "success"} />
        <StatTile label="Critical" value={critical.length} tone={critical.length ? "danger" : "success"} />
        <StatTile label="Meters baselined" value={baselines.data?.length ?? 0} />
        <StatTile label="Active rules" value={(rules.data ?? []).filter((r) => r.is_active).length} />
      </div>

      <div className="space-y-5">
        <Card title="Flagged consumption">
          {open.length > 0 ? (
            <TableWrap>
              <thead>
                <tr>
                  <Th>Unit</Th>
                  <Th>Utility</Th>
                  <Th>Detail</Th>
                  <Th align="right">Observed</Th>
                  <Th align="right">Expected</Th>
                  <Th align="right">Deviation</Th>
                  <Th>Severity</Th>
                  <Th />
                </tr>
              </thead>
              <tbody>
                {open.map((alert) => {
                  const unit = alert.units as {
                    unit_number: string;
                    properties: { name: string } | null;
                  } | null;

                  return (
                    <tr key={alert.id}>
                      <Td>
                        {unit?.unit_number ?? "—"}
                        <span className="block text-xs text-slate-500">
                          {unit?.properties?.name}
                        </span>
                      </Td>
                      <Td>{humanise(alert.utility)}</Td>
                      <Td className="max-w-sm">{alert.detail}</Td>
                      <Td align="right">{formatNumber(alert.observed_value, 1)}</Td>
                      <Td align="right">{formatNumber(alert.expected_value, 1)}</Td>
                      <Td align="right" className="font-medium text-red-600">
                        +{formatNumber(alert.deviation_percent, 0)}%
                      </Td>
                      <Td>
                        <StatusBadge status={alert.severity} />
                      </Td>
                      <Td>
                        <AcknowledgeAlertButton alertId={alert.id} />
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </TableWrap>
          ) : (
            <EmptyState
              title="No open flags"
              description="Every metered unit is tracking within its normal range."
            />
          )}
        </Card>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <Card title="Detection rules">
            {rules.data && rules.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Utility</Th>
                    <Th>Rule</Th>
                    <Th align="right">Spike threshold</Th>
                    <Th>Severity</Th>
                  </tr>
                </thead>
                <tbody>
                  {rules.data.map((rule) => (
                    <tr key={rule.id}>
                      <Td>{humanise(rule.utility)}</Td>
                      <Td>{humanise(rule.rule)}</Td>
                      <Td align="right">
                        {rule.spike_percent ? `+${formatNumber(rule.spike_percent, 0)}%` : "—"}
                      </Td>
                      <Td>
                        <StatusBadge status={rule.severity} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState
                title="No rules configured"
                description="Without a rule, consumption is recorded but never flagged."
              />
            )}
          </Card>

          <Card title="Latest readings">
            {readings.data && readings.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Meter</Th>
                    <Th>Unit</Th>
                    <Th align="right">Reading</Th>
                    <Th align="right">Consumption</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {readings.data.map((reading) => {
                    const meter = reading.meters as {
                      meter_number: string;
                      type: string;
                      units: { unit_number: string } | null;
                    } | null;

                    return (
                      <tr key={reading.id}>
                        <Td>{meter?.meter_number ?? "—"}</Td>
                        <Td>{meter?.units?.unit_number ?? "—"}</Td>
                        <Td align="right">{formatNumber(reading.reading, 1)}</Td>
                        <Td align="right">{formatNumber(reading.consumption, 2)}</Td>
                        <Td>{humanise(reading.source)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No readings captured" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
