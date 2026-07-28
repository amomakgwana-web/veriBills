import { resolveUnit } from "@/lib/tenant-context";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/domain/money";
import { BookFacilityForm } from "@/components/tenant/book-facility";
import {
  Badge,
  Card,
  EmptyState,
  PageHeader,
  StatusBadge,
  TableWrap,
  Td,
  Th,
  humanise,
} from "@/components/ui";

export const metadata = { title: "Facilities" };

export default async function FacilitiesPage({
  searchParams,
}: {
  searchParams: Promise<{ unit?: string }>;
}) {
  const { session, unit } = await resolveUnit(searchParams);
  const supabase = await createClient();

  // Async Server Component: renders once per request, so this is stable.
  // eslint-disable-next-line react-hooks/purity
  const bookingsSince = new Date(Date.now() - 7 * 86400_000).toISOString();

  const [facilities, grants, bookings] = await Promise.all([
    supabase
      .from("facilities")
      .select(
        "id, name, kind, description, capacity, requires_booking, requires_induction, requires_good_standing, booking_fee, opens_at, closes_at, max_booking_minutes",
      )
      .eq("property_id", unit.propertyId)
      .eq("is_active", true)
      .order("name"),
    supabase
      .from("facility_access_grants")
      .select("id, facility_id, status, access_tag, induction_completed_at")
      .eq("profile_id", session.userId),
    supabase
      .from("facility_bookings")
      .select("id, facility_id, status, starts_at, ends_at, guest_count, fee_amount, facilities(name)")
      .eq("profile_id", session.userId)
      .gte("ends_at", bookingsSince)
      .order("starts_at", { ascending: true })
      .limit(20),
  ]);

  const inArrears = Number(unit.balance ?? 0) > 0;
  const grantFor = (facilityId: string) =>
    (grants.data ?? []).find((g) => g.facility_id === facilityId);

  return (
    <>
      <PageHeader
        title="Facilities"
        description={`${unit.propertyName} · gym, clubhouse and shared spaces`}
      />

      {inArrears && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
          Your account is in arrears. Facilities that require good standing are locked until the
          balance is settled.
        </div>
      )}

      <div className="mb-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {(facilities.data ?? []).map((facility) => {
          const grant = grantFor(facility.id);
          const locked = facility.requires_good_standing && inArrears;
          const hasAccess = grant?.status === "active" && !locked;

          return (
            <Card key={facility.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    {facility.name}
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {humanise(facility.kind)} · {facility.opens_at.slice(0, 5)}–
                    {facility.closes_at.slice(0, 5)}
                  </p>
                </div>
                <Badge tone={hasAccess ? "success" : locked ? "danger" : "neutral"}>
                  {hasAccess
                    ? "Access granted"
                    : locked
                      ? "Locked"
                      : grant
                        ? humanise(grant.status)
                        : "No access"}
                </Badge>
              </div>

              {facility.description && (
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                  {facility.description}
                </p>
              )}

              <dl className="mt-3 space-y-1 text-xs text-slate-500 dark:text-slate-400">
                {facility.capacity && (
                  <div className="flex justify-between">
                    <dt>Capacity</dt>
                    <dd>{facility.capacity}</dd>
                  </div>
                )}
                {Number(facility.booking_fee) > 0 && (
                  <div className="flex justify-between">
                    <dt>Booking fee</dt>
                    <dd>{formatMoney(facility.booking_fee)}</dd>
                  </div>
                )}
                {grant?.access_tag && (
                  <div className="flex justify-between">
                    <dt>Access tag</dt>
                    <dd className="font-mono">{grant.access_tag}</dd>
                  </div>
                )}
                {facility.requires_induction && !grant?.induction_completed_at && (
                  <div className="text-red-700 dark:text-red-400">Induction required</div>
                )}
              </dl>

              {facility.requires_booking && (
                <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                  <BookFacilityForm
                    facilityId={facility.id}
                    unitId={unit.unitId}
                    maxMinutes={facility.max_booking_minutes}
                    disabled={locked}
                  />
                </div>
              )}
            </Card>
          );
        })}

        {(facilities.data?.length ?? 0) === 0 && (
          <div className="md:col-span-2 lg:col-span-3">
            <EmptyState
              title="No shared facilities"
              description="This property does not have bookable facilities configured."
            />
          </div>
        )}
      </div>

      <Card title="Your bookings">
        {bookings.data && bookings.data.length > 0 ? (
          <TableWrap>
            <thead>
              <tr>
                <Th>Facility</Th>
                <Th>When</Th>
                <Th>Guests</Th>
                <Th align="right">Fee</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {bookings.data.map((booking) => (
                <tr key={booking.id}>
                  <Td>{(booking.facilities as { name: string } | null)?.name ?? "—"}</Td>
                  <Td>
                    {new Date(booking.starts_at).toLocaleString("en-ZA", {
                      day: "numeric",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </Td>
                  <Td>{booking.guest_count}</Td>
                  <Td align="right">{formatMoney(booking.fee_amount)}</Td>
                  <Td>
                    <StatusBadge status={booking.status} />
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableWrap>
        ) : (
          <EmptyState title="No bookings" description="Book a facility above to reserve a slot." />
        )}
      </Card>
    </>
  );
}
