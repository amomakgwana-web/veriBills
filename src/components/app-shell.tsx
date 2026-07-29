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

  // Someone can hold more than one portal; offer the others in the sidebar.
  const otherPortals = [
    session.units.length > 0 && { href: "/tenant", label: "Tenant" },
    session.memberships.length > 0 && { href: "/estate", label: "Estate" },
    session.isSystemAdmin && { href: "/admin", label: "Platform" },
  ].filter((p): p is { href: string; label: string } => Boolean(p) && (p as { href: string }).href !== portalHref);

  return (
    <div className="min-h-screen lg:flex">
      {/* Pure-CSS mobile drawer: this checkbox is the only state, toggled by
          the two labels below (hamburger + backdrop) — no client JS needed. */}
      <input type="checkbox" id="sidebar-toggle" className="peer hidden" />

      <label
        htmlFor="sidebar-toggle"
        aria-hidden="true"
        className="fixed inset-0 z-30 hidden bg-black/40 peer-checked:block lg:hidden"
      />

      <aside className="bg-brand-900 fixed top-0 left-0 z-40 flex h-screen w-64 -translate-x-full flex-col transition-transform duration-200 peer-checked:translate-x-0 lg:sticky lg:h-screen lg:w-60 lg:translate-x-0">
        <div className="flex h-14 shrink-0 items-center gap-2 border-b border-white/10 px-4">
          <Link href={portalHref} className="flex min-w-0 items-center gap-2">
            <LogoMark size="sm" className="shrink-0 ring-1 ring-white/30" />
            <span className="truncate text-sm font-semibold text-white">
              veriBills
              <span className="text-brand-200 ml-1.5 font-normal">{portalName}</span>
            </span>
          </Link>
          <label
            htmlFor="sidebar-toggle"
            aria-label="Close menu"
            className="text-brand-100 ml-auto rounded-lg p-1.5 hover:bg-white/10 hover:text-white lg:hidden"
          >
            <CloseIcon />
          </label>
        </div>

        {switcher && <div className="border-b border-white/10 px-3 py-3">{switcher}</div>}

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          <ul className="space-y-0.5">
            {nav.map((item) => (
              <li key={item.href}>
                <NavLink href={item.href}>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge ? (
                    <span
                      className={cx(
                        "rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-semibold text-white",
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

        <div className="shrink-0 space-y-2 border-t border-white/10 px-3 py-3">
          {otherPortals.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {otherPortals.map((p) => (
                <Link
                  key={p.href}
                  href={p.href}
                  className="text-brand-100 rounded-lg px-2 py-1 text-xs font-medium hover:bg-white/10 hover:text-white"
                >
                  {p.label}
                </Link>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 px-1 py-1">
            <Link
              href={portalHref === "/tenant" ? "/tenant/profile" : "/estate/profile"}
              title={session.fullName ?? session.email}
              className="text-brand-700 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-xs font-semibold"
            >
              {initials || "?"}
            </Link>
            <span className="text-brand-100 min-w-0 flex-1 truncate text-xs">
              {session.fullName ?? session.email}
            </span>
          </div>

          <SignOutButton className="text-brand-100 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-medium hover:bg-white/10 hover:text-white" />
        </div>
      </aside>

      <div className="flex min-h-screen flex-1 flex-col">
        <header className="bg-brand-700 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 px-4 lg:hidden">
          <label
            htmlFor="sidebar-toggle"
            aria-label="Open menu"
            className="text-brand-100 rounded-lg p-1.5 hover:bg-white/10 hover:text-white"
          >
            <MenuIcon />
          </label>
          <span className="text-sm font-semibold text-white">
            veriBills
            <span className="text-brand-200 ml-1.5 font-normal">{portalName}</span>
          </span>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
      </div>

      <ChatWidget userName={session.fullName ?? session.email} />
      <InactivityLogout />
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="4" y1="6" x2="20" y2="6" strokeLinecap="round" />
      <line x1="4" y1="12" x2="20" y2="12" strokeLinecap="round" />
      <line x1="4" y1="18" x2="20" y2="18" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="6" y1="6" x2="18" y2="18" strokeLinecap="round" />
      <line x1="18" y1="6" x2="6" y2="18" strokeLinecap="round" />
    </svg>
  );
}
