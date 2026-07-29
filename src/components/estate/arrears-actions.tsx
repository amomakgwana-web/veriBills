"use client";

import { useActionState, useRef } from "react";
import { useFormStatus } from "react-dom";

import {
  assignCollector,
  sendArrearsReminder,
  escalateToLegal,
  type ActionState,
} from "@/lib/actions/estate";
import { buttonClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

export function AssignCollectorForm({
  orgId,
  accountId,
  collectorId,
  collectors,
}: {
  orgId: string;
  accountId: string;
  collectorId: string | null;
  collectors: Array<{ id: string; name: string }>;
}) {
  const [, action] = useActionState(assignCollector, INITIAL);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} action={action}>
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="account_id" value={accountId} />
      <select
        name="collector_id"
        defaultValue={collectorId ?? ""}
        onChange={() => formRef.current?.requestSubmit()}
        className="rounded-md border border-slate-300 bg-white px-1.5 py-1 text-xs text-slate-700"
      >
        <option value="">Unassigned</option>
        {collectors.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
    </form>
  );
}

export function SendReminderButton({ orgId, accountId }: { orgId: string; accountId: string }) {
  const [state, action] = useActionState(sendArrearsReminder, INITIAL);

  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="account_id" value={accountId} />
      <SubmitButton idleLabel="Remind" pendingLabel="Sending…" />
      {state.status === "error" && (
        <span role="alert" className="ml-1.5 text-xs text-red-600">
          {state.message}
        </span>
      )}
    </form>
  );
}

export function EscalateToLegalButton({ orgId, accountId }: { orgId: string; accountId: string }) {
  const [state, action] = useActionState(escalateToLegal, INITIAL);

  return (
    <form
      action={action}
      className="inline-block"
      onSubmit={(e) => {
        if (!window.confirm("Open a legal matter for this account?")) e.preventDefault();
      }}
    >
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="account_id" value={accountId} />
      <SubmitButton idleLabel="Escalate" pendingLabel="Opening…" variant="danger" />
      {state.status === "error" && (
        <span role="alert" className="ml-1.5 text-xs text-red-600">
          {state.message}
        </span>
      )}
    </form>
  );
}

function SubmitButton({
  idleLabel,
  pendingLabel,
  variant = "secondary",
}: {
  idleLabel: string;
  pendingLabel: string;
  variant?: "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass(variant, "sm")}>
      {pending ? pendingLabel : idleLabel}
    </button>
  );
}
