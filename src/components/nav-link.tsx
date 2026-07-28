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
          ? "border-white text-white"
          : "text-brand-200 border-transparent hover:border-white/40 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}
