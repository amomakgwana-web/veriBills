import { requireOrgAccess, type Membership, type SessionContext } from "@/lib/auth/session";

/**
 * Resolve which organisation a staff page is scoped to. Mirrors the tenant
 * portal's unit resolution: the `org` query parameter selects, first
 * membership is the default.
 */
export async function resolveOrg(
  searchParams?: Promise<{ org?: string }> | { org?: string },
): Promise<{ session: SessionContext; membership: Membership }> {
  const { session, membership } = await requireOrgAccess();
  const params = searchParams ? await searchParams : {};

  const selected = session.memberships.find((m) => m.orgId === params.org);

  return { session, membership: selected ?? membership };
}
