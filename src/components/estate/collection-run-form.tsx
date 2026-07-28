"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { runCollections, type ActionState } from "@/lib/actions/estate";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

export function CollectionRunForm({
  orgId,
  mandateCount,
}: {
  orgId: string;
  mandateCount: number;
}) {
  const [state, action] = useActionState(runCollections, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="org_id" value={orgId} />

      <Field label="Action date" hint="The date funds are drawn from debtor accounts.">
        <input
          name="action_date"
          type="date"
          required
          defaultValue={new Date().toISOString().slice(0, 10)}
          className={inputClass}
        />
      </Field>

      <p className="text-sm text-slate-600 dark:text-slate-400">
        {mandateCount} authenticated mandate{mandateCount === 1 ? "" : "s"} will be submitted.
        Successful collections post to the tenant ledger automatically.
      </p>

      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-xs text-brand-600 dark:text-brand-400">
          {state.message}
        </p>
      )}

      <SubmitButton disabled={mandateCount === 0} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${buttonClass("primary")} w-full`}
    >
      {pending ? "Submitting…" : "Submit collections"}
    </button>
  );
}
