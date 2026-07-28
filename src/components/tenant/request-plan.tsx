"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { requestPaymentPlan, type ActionState } from "@/lib/actions/tenant";
import { buttonClass, Field, inputClass } from "@/components/ui";
import { formatMoney, splitInstalments } from "@/lib/domain/money";

const INITIAL: ActionState = { status: "idle" };

export function RequestPlanForm({ accountId, balance }: { accountId: string; balance: number }) {
  const [state, action] = useActionState(requestPaymentPlan, INITIAL);
  const [instalments, setInstalments] = useState(6);
  const [deposit, setDeposit] = useState(0);

  const arrearsCents = Math.round((balance - deposit) * 100);
  const preview =
    arrearsCents > 0 && instalments > 0 ? splitInstalments(arrearsCents, instalments)[0] / 100 : 0;

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="account_id" value={accountId} />

      <Field label="Upfront deposit" hint="Optional. Reduces what gets spread across the instalments.">
        <input
          name="deposit_amount"
          type="number"
          min="0"
          step="0.01"
          value={deposit}
          onChange={(e) => setDeposit(Number(e.target.value))}
          className={inputClass}
        />
      </Field>

      <Field label="Number of instalments">
        <input
          name="instalment_count"
          type="number"
          min="1"
          max="36"
          value={instalments}
          onChange={(e) => setInstalments(Number(e.target.value))}
          className={inputClass}
        />
      </Field>

      <Field label="Note to your estate" hint="Optional. Anything they should know before deciding.">
        <textarea name="note" rows={2} className={inputClass} />
      </Field>

      {preview > 0 && (
        <div className="bg-brand-50 rounded-lg px-3 py-2 text-sm">
          <span className="text-slate-600">Estimated monthly instalment</span>
          <span className="text-brand-800 float-right font-semibold">{formatMoney(preview)}</span>
        </div>
      )}

      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-brand-600 text-xs">
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
    <button type="submit" disabled={pending} className={`${buttonClass("primary", "sm")} w-full`}>
      {pending ? "Sending…" : "Request payment plan"}
    </button>
  );
}
