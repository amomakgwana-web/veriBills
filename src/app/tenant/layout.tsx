import { requireTenant } from "@/lib/auth/session";
import { AppShell, type NavItem } from "@/components/app-shell";
import { UnitSwitcher } from "@/components/unit-switcher";

const NAV: NavItem[] = [
  { href: "/tenant", label: "Overview" },
  { href: "/tenant/billing", label: "Billing" },
  { href: "/tenant/electricity", label: "Electricity" },
  { href: "/tenant/maintenance", label: "Maintenance" },
  { href: "/tenant/access", label: "Access" },
  { href: "/tenant/facilities", label: "Facilities" },
  { href: "/tenant/announcements", label: "Announcements" },
  { href: "/tenant/documents", label: "Documents" },
  { href: "/tenant/profile", label: "Profile" },
];

export default async function TenantLayout({ children }: { children: React.ReactNode }) {
  const session = await requireTenant();

  return (
    <AppShell
      session={session}
      nav={NAV}
      portalName="Tenant"
      portalHref="/tenant"
      switcher={session.units.length > 1 ? <UnitSwitcher units={session.units} /> : undefined}
    >
      {children}
    </AppShell>
  );
}
