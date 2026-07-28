"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createCampaign, type ActionState } from "@/lib/actions/estate";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

const REASONS = [
  { value: "bill_presentment", label: "Bill presentment" },
  { value: "outstanding_fees", label: "Outstanding fees" },
  { value: "payment_reminder", label: "Payment reminder" },
  { value: "failed_collection", label: "Failed collection" },
  { value: "lease_expiry", label: "Lease expiry" },
  { value: "policy_update", label: "Policy update" },
  { value: "maintenance_notice", label: "Maintenance notice" },
  { value: "meter_reading_request", label: "Meter reading request" },
  { value: "general", label: "General" },
];

export function CampaignForm({
  orgId,
  properties,
}: {
  orgId: string;
  properties: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(createCampaign, INITIAL);
  const [channel, setChannel] = useState<"email" | "sms">("email");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="org_id" value={orgId} />

      <Field label="Campaign name">
        <input name="name" required className={inputClass} placeholder="July arrears reminder" />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Channel">
          <select
            name="channel"
            value={channel}
            onChange={(e) => setChannel(e.target.value as "email" | "sms")}
            className={inputClass}
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
          </select>
        </Field>

        <Field label="Reason">
          <select name="reason" className={inputClass} defaultValue="outstanding_fees">
            {REASONS.map((reason) => (
              <option key={reason.value} value={reason.value}>
                {reason.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Property" hint="Leave blank for the whole portfolio.">
        <select name="property_id" className={inputClass} defaultValue="">
          <option value="">All properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="in_arrears"
          defaultChecked
          className="text-brand-600 focus:ring-brand-500 rounded border-slate-300"
        />
        Only tenants in arrears
      </label>

      {channel === "email" && (
        <Field label="Subject">
          <input name="subject" className={inputClass} placeholder="Your account is overdue" />
        </Field>
      )}

      <Field
        label="Message"
        hint="Use {{name}} and {{balance}} to personalise. Email is wrapped in your letterhead."
      >
        <textarea
          name="body"
          required
          rows={5}
          className={inputClass}
          placeholder={"Hi {{name}},\n\nYour account is currently {{balance}} in arrears."}
        />
      </Field>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="send_now"
          className="text-brand-600 focus:ring-brand-500 rounded border-slate-300"
        />
        Send immediately
      </label>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {state.message}
        </p>
      )}
      {state.status === "success" && (
        <p
          role="status"
          className="rounded-lg border border-brand-200 bg-brand-50 px-3 py-2 text-sm text-brand-700"
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
      {pending ? "Working…" : "Save campaign"}
    </button>
  );
}
