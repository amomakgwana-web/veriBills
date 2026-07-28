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
        "my-1.5 inline-flex items-center rounded-[19px] px-3.5 py-1.5 text-sm font-medium transition",
        active
          ? "text-brand-700 bg-white"
          : "text-brand-100 hover:bg-white/10 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
