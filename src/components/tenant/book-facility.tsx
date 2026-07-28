"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { bookFacility, type ActionState } from "@/lib/actions/tenant";
import { buttonClass, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

export function BookFacilityForm({
  facilityId,
  unitId,
  maxMinutes,
  disabled,
}: {
  facilityId: string;
  unitId: string;
  maxMinutes: number;
  disabled?: boolean;
}) {
  const [state, action] = useActionState(bookFacility, INITIAL);

  const durations = [30, 60, 90, 120].filter((m) => m <= maxMinutes);
  if (durations.length === 0) durations.push(maxMinutes);

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="facility_id" value={facilityId} />
      <input type="hidden" name="unit_id" value={unitId} />

      <div className="flex gap-2">
        <input
          type="datetime-local"
          name="starts_at"
          required
          disabled={disabled}
          className={`${inputClass} text-xs`}
          aria-label="Start time"
        />
        <select
          name="minutes"
          disabled={disabled}
          className={`${inputClass} w-28 text-xs`}
          aria-label="Duration"
        >
          {durations.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </select>
      </div>

      {state.status === "error" && (
        <p role="alert" className="text-xs text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p role="status" className="text-xs text-emerald-600 dark:text-emerald-400">
          {state.message}
        </p>
      )}

      <SubmitButton disabled={disabled} />
    </form>
  );
}

function SubmitButton({ disabled }: { disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending || disabled}
      className={`${buttonClass("secondary", "sm")} w-full`}
    >
      {pending ? "Booking…" : "Book"}
    </button>
  );
}
