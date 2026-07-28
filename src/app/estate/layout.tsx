import { requireOrgAccess } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { AppShell, type NavItem } from "@/components/app-shell";
import { OrgSwitcher } from "@/components/org-switcher";

export default async function EstateLayout({ children }: { children: React.ReactNode }) {
  const { session, membership } = await requireOrgAccess();
  const supabase = await createClient();

  // Badge the approvals tab so pending work is visible from anywhere.
  const { count } = await supabase
    .from("approvals")
    .select("id", { count: "exact", head: true })
    .eq("org_id", membership.orgId)
    .eq("status", "pending");

  const nav: NavItem[] = [
    { href: "/estate", label: "Dashboard" },
    { href: "/estate/tenants", label: "Tenants" },
    { href: "/estate/billing", label: "Billing" },
    { href: "/estate/collections", label: "Collections" },
    { href: "/estate/maintenance", label: "Maintenance" },
    { href: "/estate/usage", label: "Usage" },
    { href: "/estate/campaigns", label: "Campaigns" },
    { href: "/estate/announcements", label: "Announcements" },
    { href: "/estate/approvals", label: "Approvals", badge: count ?? 0 },
    { href: "/estate/applications", label: "Applications" },
    { href: "/estate/audit", label: "Audit" },
  ];

  return (
    <AppShell
      session={session}
      nav={nav}
      portalName="Estate"
      portalHref="/estate"
      switcher={
        session.memberships.length > 1 ? (
          <OrgSwitcher memberships={session.memberships} />
        ) : (
          <span className="hidden text-xs font-medium text-slate-500 md:block dark:text-slate-400">
            {membership.orgName}
          </span>
        )
      }
    >
      {children}
    </AppShell>
  );
}
