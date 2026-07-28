import type { ReactNode } from "react";
import Link from "next/link";

import type { SessionContext } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { ChatWidget } from "@/components/chat-widget";
import { NavLink } from "@/components/nav-link";
import { cx } from "@/components/ui";

export type NavItem = { href: string; label: string; badge?: number };

export function AppShell({
  session,
  nav,
  portalName,
  portalHref,
  children,
  switcher,
}: {
  session: SessionContext;
  nav: NavItem[];
  portalName: string;
  portalHref: string;
  children: ReactNode;
  switcher?: ReactNode;
}) {
  const initials = (session.fullName ?? session.email)
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  // Someone can hold more than one portal; offer the others in the header.
  const otherPortals = [
    session.units.length > 0 && { href: "/tenant", label: "Tenant" },
    session.memberships.length > 0 && { href: "/estate", label: "Estate" },
    session.isSystemAdmin && { href: "/admin", label: "Platform" },
  ].filter((p): p is { href: string; label: string } => Boolean(p) && (p as { href: string }).href !== portalHref);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-900/90">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href={portalHref} className="flex shrink-0 items-center gap-2">
            <span className="bg-brand-700 flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white">
              vB
            </span>
            <span className="hidden text-sm font-semibold text-slate-900 sm:block dark:text-slate-100">
              veriBills
              <span className="ml-1.5 font-normal text-slate-400">{portalName}</span>
            </span>
          </Link>

          {switcher}

          <div className="ml-auto flex items-center gap-2">
            {otherPortals.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="hidden rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 md:block dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {p.label}
              </Link>
            ))}

            <Link
              href={portalHref === "/tenant" ? "/tenant/profile" : "/estate/profile"}
              title={session.fullName ?? session.email}
              className="bg-brand-100 text-brand-800 dark:bg-brand-900 dark:text-brand-200 flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
            >
              {initials || "?"}
            </Link>

            <SignOutButton className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" />
          </div>
        </div>

        <nav className="mx-auto max-w-7xl overflow-x-auto px-4">
          <ul className="flex gap-1 pb-px whitespace-nowrap">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>
                  {item.label}
                  {item.badge ? (
                    <span
                      className={cx(
                        "ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                        "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
                      )}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>

      <ChatWidget userName={session.fullName ?? session.email} />
    </div>
  );
}
