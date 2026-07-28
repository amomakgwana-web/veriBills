"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

import type { TenantUnit } from "@/lib/auth/session";

/**
 * Switches which unit the tenant portal is looking at. The selection rides in
 * the query string so every page reads it the same way and links stay shareable.
 */
export function UnitSwitcher({ units }: { units: TenantUnit[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const current = searchParams.get("unit") ?? units[0]?.unitId;

  return (
    <label className="flex items-center gap-2">
      <span className="sr-only">Select unit</span>
      <select
        value={current}
        onChange={(event) => {
          const params = new URLSearchParams(searchParams.toString());
          params.set("unit", event.target.value);
          router.push(`${pathname}?${params.toString()}`);
        }}
        className="max-w-[14rem] rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-brand-500 focus:outline-none"
      >
        {units.map((unit) => (
          <option key={unit.unitId} value={unit.unitId}>
            {unit.propertyName} · {unit.unitNumber}
          </option>
        ))}
      </select>
    </label>
  );
}
