import { requireSystemAdmin } from "@/lib/auth/session";
import { AppShell, type NavItem } from "@/components/app-shell";

const NAV: NavItem[] = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/organisations", label: "Organisations" },
  { href: "/admin/branding", label: "White labelling" },
  { href: "/admin/units", label: "Unit configuration" },
  { href: "/admin/tariffs", label: "Tariffs" },
  { href: "/admin/meters", label: "Meters" },
  { href: "/admin/integrations", label: "Integrations" },
  { href: "/admin/deliveries", label: "Delivery trail" },
  { href: "/admin/statements", label: "Statements" },
  { href: "/admin/reports", label: "Reports" },
  { href: "/admin/health", label: "System health" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireSystemAdmin();

  return (
    <AppShell session={session} nav={NAV} portalName="Platform" portalHref="/admin">
      {children}
    </AppShell>
  );
}
