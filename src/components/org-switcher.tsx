"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { Membership } from "@/lib/auth/session";

/** Switches which estate/organisation the staff portal is scoped to. */
export function OrgSwitcher({ memberships }: { memberships: Membership[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("org") ?? memberships[0]?.orgId;

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Select estate</span>
      <select
        value={current}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("org", event.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="focus:border-brand-500 max-w-[14rem] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {memberships.map((membership) => (
          <option key={membership.orgId} value={membership.orgId}>
            {membership.orgName}
          </option>
        ))}
      </select>
    </label>
  );
}
