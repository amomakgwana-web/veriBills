"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { cx } from "@/components/ui";

export function NavLink({ href, children }: { href: string; children: ReactNode }) {
  const pathname = usePathname();

  // The portal root should only light up on an exact match, otherwise it stays
  // active on every child route.
  const segments = href.split("/").filter(Boolean);
  const isRoot = segments.length <= 1;
  const active = isRoot ? pathname === href : pathname.startsWith(href);

  return (
    <Link
      href={href}
      className={cx(
        "-mb-px inline-flex items-center border-b-2 px-3 py-2.5 text-sm font-medium transition",
        active
          ? "border-brand-600 text-brand-700 dark:border-brand-400 dark:text-brand-300"
          : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
      )}
    >
      {children}
    </Link>
  );
}
