"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { publishAnnouncement, type ActionState } from "@/lib/actions/estate";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

const CATEGORIES = [
  "general",
  "maintenance",
  "outage",
  "security",
  "billing",
  "event",
  "emergency",
];

export function AnnouncementForm({
  orgId,
  properties,
}: {
  orgId: string;
  properties: Array<{ id: string; name: string }>;
}) {
  const [state, action] = useActionState(publishAnnouncement, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="org_id" value={orgId} />

      <Field label="Title">
        <input name="title" required className={inputClass} placeholder="Water outage on Tuesday" />
      </Field>

      <Field label="Property" hint="Leave blank to notify every property.">
        <select name="property_id" className={inputClass} defaultValue="">
          <option value="">All properties</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Category">
          <select name="category" className={inputClass} defaultValue="general">
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {category.replace(/\b\w/g, (c) => c.toUpperCase())}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Severity">
          <select name="severity" className={inputClass} defaultValue="info">
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
          </select>
        </Field>
      </div>

      <Field label="Message">
        <textarea name="body" required rows={5} className={inputClass} />
      </Field>

      <div className="space-y-2">
        <Checkbox name="is_pinned" label="Pin to the top of tenant portals" />
        <Checkbox name="send_email" label="Also email tenants" />
        <Checkbox name="send_sms" label="Also SMS tenants" />
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

function Checkbox({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        className="text-brand-600 focus:ring-brand-500 rounded border-slate-300"
      />
      {label}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${buttonClass("primary")} w-full`}>
      {pending ? "Publishing…" : "Publish"}
    </button>
  );
}
