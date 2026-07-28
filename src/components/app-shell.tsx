import type { ReactNode } from "react";
import Link from "next/link";

import type { SessionContext } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { ChatWidget } from "@/components/chat-widget";
import { NavLink } from "@/components/nav-link";
import { LogoMark } from "@/components/brand/logo-mark";
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
      <header className="border-white/40 dark:border-white/10 sticky top-0 z-30 border-b bg-white/60 shadow-[0_1px_0_0_rgba(255,255,255,0.5)_inset] backdrop-blur-xl backdrop-saturate-150 dark:bg-slate-900/50">
        <div className="from-brand-600 via-brand-500 to-brand-700 h-1 bg-gradient-to-r" />

        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href={portalHref} className="flex shrink-0 items-center gap-2">
            <LogoMark size="sm" />
            <span className="text-brand-700 dark:text-brand-300 hidden text-sm font-semibold sm:block">
              veriBills
              <span className="text-brand-400 dark:text-brand-500 ml-1.5 font-normal">
                {portalName}
              </span>
            </span>
          </Link>

          {switcher}

          <div className="ml-auto flex items-center gap-2">
            {otherPortals.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300 hidden rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 md:block dark:text-slate-300"
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

            <SignOutButton className="hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-brand-950/40 dark:hover:text-brand-300 rounded-lg px-2.5 py-1.5 text-xs font-medium text-slate-600 dark:text-slate-300" />
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
