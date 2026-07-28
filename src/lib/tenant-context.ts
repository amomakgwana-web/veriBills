import { requireTenant, type SessionContext, type TenantUnit } from "@/lib/auth/session";

/**
 * Resolve which of the tenant's units a page is showing.
 * The `unit` query parameter drives it, falling back to the first unit.
 */
export async function resolveUnit(
  searchParams?: Promise<{ unit?: string }> | { unit?: string },
): Promise<{ session: SessionContext; unit: TenantUnit }> {
  const session = await requireTenant();
  const params = searchParams ? await searchParams : {};

  const unit =
    session.units.find((u) => u.unitId === params.unit) ?? session.units[0];

  return { session, unit };
}
