import type { VbRole } from "@veribills/shared-types";

/**
 * One signed-in identity for the whole platform. The role decides which
 * product areas are visible client-side; Postgres RLS policies
 * (db/002_auth_and_rls.sql) and the RPC functions from db/004 onward are
 * what actually enforce it server-side, both keyed off the same custom
 * claims public.custom_access_token_hook injects into every JWT.
 */
export interface Session {
  role: VbRole;
  name: string;
  /** Set only for tenants — their one unit for the whole session (Section 3.3: "one tenant, one unit, one lease at a time"). */
  tenantUnitId?: string;
}

export const ROLE_META: Record<VbRole, { label: string; home: string }> = {
  tenant: { label: "Tenant", home: "/xbilling" },
  sysadmin: { label: "SysAdmin", home: "/xlayer" },
  data_admin: { label: "Data Admin", home: "/xutilities" },
  data_analyst: { label: "Data Analyst", home: "/xutilities" },
  compliance_officer: { label: "Compliance Officer", home: "/xutilities" },
  landlord: { label: "Landlord", home: "/xutilities" },
  estate_manager: { label: "Estate Manager", home: "/xutilities" },
  it_admin: { label: "IT Admin", home: "/xlayer" },
};

/**
 * Which product areas each role may see (Sections 3.3, 4.3, 5.3 of the
 * Technical Platform Document). xBilling is tenant-only; xUtilities is
 * every back-office role except tenant; xLayer is SysAdmin/IT Admin only.
 */
export const AREA_ACCESS: Record<"xbilling" | "xutilities" | "xlayer", VbRole[]> = {
  xbilling: ["tenant"],
  xutilities: ["sysadmin", "data_admin", "data_analyst", "compliance_officer", "landlord", "estate_manager"],
  xlayer: ["sysadmin", "it_admin"],
};

/**
 * Decodes the custom claims (public.custom_access_token_hook,
 * db/002_auth_and_rls.sql + db/003_drop_municipal_platform.sql) out of a
 * Supabase access token into the Session shape the rest of the app
 * expects. No signature verification here — that's Supabase's job when
 * it issued the token; this only ever runs against a token this same
 * client received directly from supabase.auth. Tokens belonging to the
 * unrelated product sharing this Supabase project carry `app: "xplatform"`
 * (or no `app` claim at all pre-migration) and are rejected here.
 */
export function sessionFromJwt(accessToken: string): Session | null {
  const parts = accessToken.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    const claims = JSON.parse(atob(padded)) as Record<string, unknown>;
    if (claims.app !== "veribills") return null;
    const role = claims.role as VbRole | undefined;
    if (!role || !(role in ROLE_META)) return null;
    return {
      role,
      name: typeof claims.name === "string" ? claims.name : (claims.email as string) ?? "Unknown",
      tenantUnitId: typeof claims.tenantUnitId === "string" ? claims.tenantUnitId : undefined,
    };
  } catch {
    return null;
  }
}
