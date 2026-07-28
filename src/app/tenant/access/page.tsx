import { resolveUnit } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import { AccessCodeForm } from "@/components/tenant/access-code-form";
import { RevokeCodeButton } from "@/components/tenant/revoke-code";
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

export const metadata = { title: "Access codes" };

export default async function AccessPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { unit } = await resolveUnit(searchParams);
  const supabase = await createClient();

  const [codes, events] = await Promise.all([
    supabase
      .from("access_codes")
      .select(
        "id, code, type, status, visitor_name, visitor_phone, vehicle_registration, valid_from, valid_until, max_uses, use_count, created_at",
      )
      .eq("unit_id", unit.unitId)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("access_events")
      .select("id, gate, direction, result, occurred_at, scanned_code")
      .eq("property_id", unit.propertyId)
      .order("occurred_at", { ascending: false })
      .limit(15),
  ]);

  const active = (codes.data ?? []).filter(
    (c) => c.status === "active" && new Date(c.valid_until) > new Date(),
  );
  const past = (codes.data ?? []).filter((c) => !active.includes(c));

  return (
    <>
      <PageHeader
        title="Gate access"
        description={`Unit ${unit.unitNumber} · ${unit.propertyName}`}
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <Card title="Create a visitor code">
            <AccessCodeForm unitId={unit.unitId} />
          </Card>
        </div>

        <div className="space-y-5 lg:col-span-2">
          <Card title={`Active codes (${active.length})`}>
            {active.length > 0 ? (
              <ul className="space-y-3">
                {active.map((code) => (
                  <li
                    key={code.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-200 p-3"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <code className="bg-brand-50 text-brand-800 rounded px-2 py-1 font-mono text-lg font-semibold tracking-widest">
                          {code.code}
                        </code>
                        <StatusBadge status={code.type} />
                      </div>
                      <p className="mt-1 text-sm text-slate-700">
                        {code.visitor_name}
                        {code.vehicle_registration ? ` · ${code.vehicle_registration}` : ""}
                      </p>
                      <p className="text-xs text-slate-500">
                        Valid until{" "}
                        {new Date(code.valid_until).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}{" "}
                        · {code.use_count}/{code.max_uses} uses
                      </p>
                    </div>
                    <RevokeCodeButton codeId={code.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState
                title="No active codes"
                description="Create one when you are expecting a visitor or delivery."
              />
            )}
          </Card>

          <Card title="Past codes">
            {past.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>Code</Th>
                    <Th>For</Th>
                    <Th>Type</Th>
                    <Th>Uses</Th>
                    <Th>Status</Th>
                  </tr>
                </thead>
                <tbody>
                  {past.map((code) => (
                    <tr key={code.id}>
                      <Td>
                        <code className="text-slate-500">{code.code}</code>
                      </Td>
                      <Td>{code.visitor_name ?? "—"}</Td>
                      <Td>{humanise(code.type)}</Td>
                      <Td>
                        {code.use_count}/{code.max_uses}
                      </Td>
                      <Td>
                        <StatusBadge status={code.status} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="Nothing here yet" />
            )}
          </Card>

          <Card title="Recent gate activity" description="Entries and exits at your estate.">
            {events.data && events.data.length > 0 ? (
              <TableWrap>
                <thead>
                  <tr>
                    <Th>When</Th>
                    <Th>Gate</Th>
                    <Th>Direction</Th>
                    <Th>Result</Th>
                  </tr>
                </thead>
                <tbody>
                  {events.data.map((event) => (
                    <tr key={event.id}>
                      <Td>
                        {new Date(event.occurred_at).toLocaleString("en-ZA", {
                          day: "numeric",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Td>
                      <Td>{event.gate ?? "—"}</Td>
                      <Td>{humanise(event.direction)}</Td>
                      <Td>
                        <StatusBadge status={event.result} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </TableWrap>
            ) : (
              <EmptyState title="No gate activity recorded" />
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
