"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createAccessCode, type ActionState } from "@/lib/actions/tenant";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

export function AccessCodeForm({ unitId }: { unitId: string }) {
  const [state, action] = useActionState(createAccessCode, INITIAL);

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="unit_id" value={unitId} />

      <Field label="Visitor name">
        <input name="visitor_name" required className={inputClass} placeholder="Sarah from No. 12" />
      </Field>

      <Field label="Type">
        <select name="type" className={inputClass} defaultValue="visitor">
          <option value="visitor">Visitor</option>
          <option value="delivery">Delivery</option>
          <option value="contractor">Contractor</option>
          <option value="once_off_event">Event guest</option>
        </select>
      </Field>

      <Field label="Mobile number" hint="Optional. We can SMS the code to them.">
        <input name="visitor_phone" type="tel" className={inputClass} placeholder="082 123 4567" />
      </Field>

      <Field label="Vehicle registration">
        <input name="vehicle_registration" className={inputClass} placeholder="CA 123-456" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Valid for (hours)">
          <input
            name="valid_hours"
            type="number"
            min="1"
            max="720"
            defaultValue="6"
            className={inputClass}
          />
        </Field>
        <Field label="Number of uses">
          <input
            name="max_uses"
            type="number"
            min="1"
            max="50"
            defaultValue="1"
            className={inputClass}
          />
        </Field>
      </div>

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
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
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
      {pending ? "Generating…" : "Generate code"}
    </button>
  );
}
