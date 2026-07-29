"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updatePaymentPlanStatus, type ActionState } from "@/lib/actions/estate";
import { buttonClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

export function PlanStatusButtons({
  orgId,
  planId,
  status,
}: {
  orgId: string;
  planId: string;
  status: string;
}) {
  const [state, action] = useActionState(updatePaymentPlanStatus, INITIAL);

  if (!["proposed", "awaiting_acceptance", "active"].includes(status)) return null;

  return (
    <form action={action} className="flex flex-wrap items-center justify-end gap-1.5">
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="plan_id" value={planId} />
      {status === "active" && (
        <StatusButton value="defaulted" label="Mark defaulted" variant="danger" />
      )}
      <StatusButton value="cancelled" label="Cancel" variant="secondary" />
      {state.status === "error" && (
        <span role="alert" className="block w-full text-right text-xs text-red-600">
          {state.message}
        </span>
      )}
    </form>
  );
}

function StatusButton({
  value,
  label,
  variant,
}: {
  value: string;
  label: string;
  variant: "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name="status"
      value={value}
      disabled={pending}
      className={buttonClass(variant, "sm")}
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
