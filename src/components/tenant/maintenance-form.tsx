"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { logMaintenance, type ActionState } from "@/lib/actions/tenant";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

const CATEGORIES = [
  "plumbing",
  "electrical",
  "appliance",
  "structural",
  "heating_cooling",
  "pest_control",
  "common_area",
  "security",
  "other",
];

export function MaintenanceForm({ unitId }: { unitId: string }) {
  const [state, action] = useActionState(logMaintenance, INITIAL);

  if (state.status === "success") {
    return (
      <div className="py-6 text-center">
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">{state.message}</p>
        <a href="/tenant/maintenance" className={`${buttonClass("secondary")} mt-4`}>
          Back to requests
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unit_id" value={unitId} />

      <Field label="What is the problem?">
        <input
          name="title"
          required
          maxLength={120}
          className={inputClass}
          placeholder="Geyser leaking into the ceiling"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Category">
          <select name="category" className={inputClass} defaultValue="plumbing">
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace(/_/g, " ").replace(/\b\w/g, (ch) => ch.toUpperCase())}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Priority" hint="Emergencies are escalated immediately.">
          <select name="priority" className={inputClass} defaultValue="normal">
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="emergency">Emergency</option>
          </select>
        </Field>
      </div>

      <Field label="Where in the unit?">
        <input
          name="location_detail"
          className={inputClass}
          placeholder="Main bathroom, above the shower"
        />
      </Field>

      <Field label="Describe the issue">
        <textarea
          name="description"
          required
          rows={5}
          className={inputClass}
          placeholder="When it started, what you have tried, anything the contractor should know."
        />
      </Field>

      <label className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          name="permission_to_enter"
          className="text-brand-600 focus:ring-brand-500 mt-0.5 rounded border-slate-300"
        />
        <span>
          I give permission for a contractor to enter the unit in my absence.
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            Without this, we will arrange a time with you first, which can take longer.
          </span>
        </span>
      </label>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
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
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Submitting…" : "Submit request"}
    </button>
  );
}
