"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { runBillingCycle, type ActionState } from "@/lib/actions/estate";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

export function BillingRunForm({
  orgId,
  properties,
}: {
  orgId: string;
  properties: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(runBillingCycle, INITIAL);

  const thisMonth = new Date().toISOString().slice(0, 7);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="org_id" value={orgId} />

      <Field label="Billing period">
        <input
          name="period_start"
          type="month"
          required
          defaultValue={thisMonth}
          className={inputClass}
        />
      </Field>

      <Field label="Property" hint="Leave blank to bill the whole portfolio.">
        <select name="property_id" className={inputClass} defaultValue="">
          <option value="">All properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </Field>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Accounts already billed for the period are skipped, so a re-run is safe.
      </p>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
        >
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p
          role="status"
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700 dark:border-brand-900 dark:bg-brand-950 dark:text-brand-300"
        >
          {state.message}
        </p>
      )}

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
      {pending ? "Running…" : "Run billing"}
    </button>
  );
}
