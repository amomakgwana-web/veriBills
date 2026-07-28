"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateMaintenanceStatus, type ActionState } from "@/lib/actions/estate";
import { buttonClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

const STATUSES = [
  "logged",
  "acknowledged",
  "assigned",
  "in_progress",
  "on_hold",
  "resolved",
  "closed",
  "rejected",
];

export function MaintenanceStatusForm({
  requestId,
  current,
}: {
  requestId: string;
  current: string;
}) {
  const [state, action] = useActionState(updateMaintenanceStatus, INITIAL);

  return (
    <form action={action} className="flex items-center gap-1.5">
      <input type="hidden" name="request_id" value={requestId} />
      <select
        name="status"
        defaultValue={current}
        aria-label="Update status"
        className="focus:border-brand-500 rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 focus:outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
      >
        {STATUSES.map((status) => (
          <option key={status} value={status}>
            {status.replace(/_/g, " ")}
          </option>
        ))}
      </select>
      <SaveButton />
      {state.status === "error" && <span className="text-xs text-red-500">{state.message}</span>}
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("secondary", "sm")}>
      {pending ? "…" : "Save"}
    </button>
  );
}
