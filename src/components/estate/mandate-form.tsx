"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createMandate, type ActionState } from "@/lib/actions/estate";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

const BANKS = [
  { name: "Absa", branch: "632005" },
  { name: "Capitec", branch: "470010" },
  { name: "FNB", branch: "250655" },
  { name: "Nedbank", branch: "198765" },
  { name: "Standard Bank", branch: "051001" },
  { name: "TymeBank", branch: "678910" },
];

export function MandateForm({
  orgId,
  accountId,
  profileId,
  suggestedAmount,
}: {
  orgId: string;
  accountId: string;
  profileId: string;
  suggestedAmount: number;
}) {
  const [state, action] = useActionState(createMandate, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="org_id" value={orgId} />
      <input type="hidden" name="account_id" value={accountId} />
      <input type="hidden" name="profile_id" value={profileId} />

      <Field label="Bank">
        <select name="bank_name" className={inputClass} defaultValue="Standard Bank">
          {BANKS.map((bank) => (
            <option key={bank.name} value={bank.name}>
              {bank.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Branch code">
          <input
            name="branch_code"
            required
            pattern="\d{6}"
            defaultValue="051001"
            className={inputClass}
          />
        </Field>
        <Field label="Account type">
          <select name="account_type" className={inputClass} defaultValue="cheque">
            <option value="cheque">Cheque</option>
            <option value="savings">Savings</option>
            <option value="transmission">Transmission</option>
          </select>
        </Field>
      </div>

      <Field label="Account number" hint="Only the last four digits are stored.">
        <input name="account_number" required className={inputClass} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Instalment">
          <input
            name="instalment_amount"
            type="number"
            step="0.01"
            min="1"
            required
            defaultValue={suggestedAmount.toFixed(2)}
            className={inputClass}
          />
        </Field>
        <Field label="Maximum" hint="Ceiling the debtor agrees to.">
          <input
            name="maximum_amount"
            type="number"
            step="0.01"
            min="1"
            required
            defaultValue={(suggestedAmount * 1.25).toFixed(2)}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Collection day">
          <input
            name="collection_day"
            type="number"
            min="1"
            max="31"
            defaultValue="1"
            className={inputClass}
          />
        </Field>
        <Field label="Authentication">
          <select name="authentication_type" className={inputClass} defaultValue="TT1">
            <option value="TT1">TT1 (real time)</option>
            <option value="TT2">TT2 (batch)</option>
            <option value="TT3">TT3 (card and PIN)</option>
          </select>
        </Field>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-xs text-brand-600">
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
    <button type="submit" disabled={pending} className={`${buttonClass("secondary", "sm")} w-full`}>
      {pending ? "Creating…" : "Create mandate"}
    </button>
  );
}
