import type { ReactNode } from "react";
import Link from "next/link";

import type { SessionContext } from "@/lib/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { ChatWidget } from "@/components/chat-widget";
import { InactivityLogout } from "@/components/inactivity-logout";
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
      <header className="bg-brand-700 sticky top-0 z-30">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3">
          <Link href={portalHref} className="flex shrink-0 items-center gap-2">
            <LogoMark size="sm" className="ring-1 ring-white/30" />
            <span className="hidden text-sm font-semibold text-white sm:block">
              veriBills
              <span className="text-brand-200 ml-1.5 font-normal">{portalName}</span>
            </span>
          </Link>

          {switcher}

          <div className="ml-auto flex items-center gap-2">
            {otherPortals.map((p) => (
              <Link
                key={p.href}
                href={p.href}
                className="text-brand-100 hidden rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-white/10 hover:text-white md:block"
              >
                {p.label}
              </Link>
            ))}

            <Link
              href={portalHref === "/tenant" ? "/tenant/profile" : "/estate/profile"}
              title={session.fullName ?? session.email}
              className="text-brand-700 flex h-8 w-8 items-center justify-center rounded-full bg-white text-xs font-semibold"
            >
              {initials || "?"}
            </Link>

            <SignOutButton className="text-brand-100 rounded-lg px-2.5 py-1.5 text-xs font-medium hover:bg-white/10 hover:text-white" />
          </div>
        </div>

        <nav className="mx-auto max-w-7xl overflow-x-auto px-4 pb-2">
          <ul className="flex gap-1 whitespace-nowrap">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>
                  {item.label}
                  {item.badge ? (
                    <span
                      className={cx(
                        "ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white",
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
      <InactivityLogout />
    </div>
  );
}
