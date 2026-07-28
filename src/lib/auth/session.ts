import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type OrgRole = Database["public"]["Enums"]["org_role"];

export type Membership = {
  orgId: string;
  orgName: string;
  orgSlug: string;
  role: OrgRole;
};

export type TenantUnit = {
  leaseId: string;
  unitId: string;
  unitNumber: string;
  propertyId: string;
  propertyName: string;
  orgId: string;
  accountId: string | null;
  accountNumber: string | null;
  balance: string | null;
};

export type SessionContext = {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  isSystemAdmin: boolean;
  memberships: Membership[];
  units: TenantUnit[];
};

/**
 * Resolve everything the layouts need about the caller in one pass.
 * `cache` dedupes this across the component tree within a single request.
 */
export const getSession = cache(async (): Promise<SessionContext | null> => {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [profileResult, membershipResult, unitResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name, avatar_url, is_system_admin, email")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("org_members")
      .select("org_id, role, organisations(name, slug)")
      .eq("profile_id", user.id)
      .eq("is_active", true),
    supabase
      .from("lease_tenants")
      .select(
        `lease_id,
         leases(
           org_id,
           unit_id,
           units(unit_number, property_id, properties(name)),
           tenant_accounts(id, account_number, balance)
         )`,
      )
      .eq("profile_id", user.id),
  ]);

  const memberships: Membership[] = (membershipResult.data ?? [])
    .map((row) => {
      const org = row.organisations as { name: string; slug: string } | null;
      if (!org) return null;
      return {
        orgId: row.org_id,
        orgName: org.name,
        orgSlug: org.slug,
        role: row.role,
      };
    })
    .filter((m): m is Membership => m !== null);

  const units: TenantUnit[] = (unitResult.data ?? [])
    .map((row) => {
      const lease = row.leases as {
        org_id: string;
        unit_id: string;
        units: { unit_number: string; property_id: string; properties: { name: string } | null } | null;
        tenant_accounts: { id: string; account_number: string; balance: string }[] | null;
      } | null;

      if (!lease?.units) return null;

      // tenant_accounts is one-per-lease, but the join returns an array.
      const account = Array.isArray(lease.tenant_accounts)
        ? lease.tenant_accounts[0]
        : lease.tenant_accounts;

      return {
        leaseId: row.lease_id,
        unitId: lease.unit_id,
        unitNumber: lease.units.unit_number,
        propertyId: lease.units.property_id,
        propertyName: lease.units.properties?.name ?? "Unknown property",
        orgId: lease.org_id,
        accountId: account?.id ?? null,
        accountNumber: account?.account_number ?? null,
        balance: account?.balance ?? null,
      };
    })
    .filter((u): u is TenantUnit => u !== null)
    .sort((a, b) => a.unitNumber.localeCompare(b.unitNumber));

  return {
    userId: user.id,
    email: profileResult.data?.email ?? user.email ?? "",
    fullName: profileResult.data?.full_name ?? null,
    avatarUrl: profileResult.data?.avatar_url ?? null,
    isSystemAdmin: profileResult.data?.is_system_admin ?? false,
    memberships,
    units,
  };
});

/** Session or bust. Use in any page that must not render for a guest. */
export async function requireSession(): Promise<SessionContext> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session;
}

export async function requireTenant(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.units.length === 0) redirect("/no-access");
  return session;
}

/** Staff access to a specific org, optionally narrowed to certain roles. */
export async function requireOrgAccess(roles?: OrgRole[]): Promise<{
  session: SessionContext;
  membership: Membership;
}> {
  const session = await requireSession();

  const membership = session.memberships.find(
    (m) => !roles || roles.includes(m.role) || m.role === "owner",
  );

  if (!membership) {
    if (session.isSystemAdmin && session.memberships.length > 0) {
      return { session, membership: session.memberships[0] };
    }
    redirect("/no-access");
  }

  return { session, membership };
}

export async function requireSystemAdmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.isSystemAdmin) redirect("/no-access");
  return session;
}

const ROLE_RANK: Record<OrgRole, number> = {
  owner: 6,
  admin: 5,
  manager: 4,
  finance: 3,
  maintenance: 2,
  viewer: 1,
};

export function roleAtLeast(role: OrgRole, minimum: OrgRole): boolean {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}
