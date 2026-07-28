"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { updateProfile, type ActionState } from "@/lib/actions/tenant";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

type Profile = {
  full_name: string | null;
  preferred_name: string | null;
  phone: string | null;
  alt_phone: string | null;
  id_number: string | null;
  id_type: string | null;
  date_of_birth: string | null;
  postal_address: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  notify_email: boolean;
  notify_sms: boolean;
  marketing_opt_in: boolean;
} | null;

export function ProfileForm({ profile, email }: { profile: Profile; email: string }) {
  const [state, action] = useActionState(updateProfile, INITIAL);

  return (
    <form action={action} className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Full name">
          <input name="full_name" defaultValue={profile?.full_name ?? ""} className={inputClass} />
        </Field>
        <Field label="Preferred name">
          <input
            name="preferred_name"
            defaultValue={profile?.preferred_name ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Email address" hint="Contact the estate to change the email on your account.">
        <input value={email} disabled className={`${inputClass} opacity-60`} />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Mobile number">
          <input
            name="phone"
            type="tel"
            defaultValue={profile?.phone ?? ""}
            className={inputClass}
            placeholder="082 123 4567"
          />
        </Field>
        <Field label="Alternative number">
          <input
            name="alt_phone"
            type="tel"
            defaultValue={profile?.alt_phone ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="Identification type">
          <select name="id_type" defaultValue={profile?.id_type ?? "sa_id"} className={inputClass}>
            <option value="sa_id">SA ID</option>
            <option value="passport">Passport</option>
            <option value="permit">Permit</option>
          </select>
        </Field>
        <Field label="ID / passport number">
          <input name="id_number" defaultValue={profile?.id_number ?? ""} className={inputClass} />
        </Field>
        <Field label="Date of birth">
          <input
            name="date_of_birth"
            type="date"
            defaultValue={profile?.date_of_birth ?? ""}
            className={inputClass}
          />
        </Field>
      </div>

      <Field label="Postal address">
        <textarea
          name="postal_address"
          rows={2}
          defaultValue={profile?.postal_address ?? ""}
          className={inputClass}
        />
      </Field>

      <fieldset className="border-t border-slate-100 pt-4">
        <legend className="sr-only">Emergency contact</legend>
        <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Emergency contact
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input
              name="emergency_contact_name"
              defaultValue={profile?.emergency_contact_name ?? ""}
              className={inputClass}
            />
          </Field>
          <Field label="Number">
            <input
              name="emergency_contact_phone"
              type="tel"
              defaultValue={profile?.emergency_contact_phone ?? ""}
              className={inputClass}
            />
          </Field>
        </div>
      </fieldset>

      <fieldset className="border-t border-slate-100 pt-4">
        <legend className="sr-only">Notifications</legend>
        <p className="mb-3 text-xs font-medium tracking-wide text-slate-500 uppercase">
          Notifications
        </p>
        <div className="space-y-2.5">
          <Toggle
            name="notify_email"
            defaultChecked={profile?.notify_email ?? true}
            label="Email me invoices, receipts and notices"
          />
          <Toggle
            name="notify_sms"
            defaultChecked={profile?.notify_sms ?? true}
            label="SMS me payment confirmations and electricity tokens"
          />
          <Toggle
            name="marketing_opt_in"
            defaultChecked={profile?.marketing_opt_in ?? false}
            label="Send me estate news and offers"
          />
        </div>
      </fieldset>

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

function Toggle({
  name,
  label,
  defaultChecked,
}: {
  name: string;
  label: string;
  defaultChecked: boolean;
}) {
  return (
    <label className="flex items-center gap-2.5 text-sm text-slate-700">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="text-brand-600 focus:ring-brand-500 rounded border-slate-300"
      />
      {label}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary")}>
      {pending ? "Saving…" : "Save changes"}
    </button>
  );
}
