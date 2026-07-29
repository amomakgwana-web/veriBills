"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { moveLegalCaseStage, type ActionState } from "@/lib/actions/estate";
import { buttonClass, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

const STAGES = [
  { value: "intake", label: "Intake" },
  { value: "demand", label: "Demand" },
  { value: "filed", label: "Filed" },
  { value: "court", label: "Court" },
  { value: "resolved", label: "Resolved" },
] as const;

export function MoveStageForm({
  orgId,
  caseId,
  currentStage,
}: {
  orgId: string;
  caseId: string;
  currentStage: string;
}) {
  const [state, action] = useActionState(moveLegalCaseStage, INITIAL);
  const [toStage, setToStage] = useState(currentStage);

  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="case_id" value={caseId} />

      <select
        name="to_stage"
        value={toStage}
        onChange={(e) => setToStage(e.target.value)}
        className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-700"
      >
        {STAGES.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>

      <input name="note" placeholder="Note (optional)" className={`${inputClass} max-w-[14rem]`} />

      <SubmitButton disabled={toStage === currentStage} />

      {state.status === "error" && (
        <span role="alert" className="text-xs text-red-600">
          {state.message}
        </span>
      )}
    </form>
  );
}

function SubmitButton({ disabled }: { disabled: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending || disabled} className={buttonClass("primary", "sm")}>
      {pending ? "Moving…" : "Move stage"}
    </button>
  );
}
