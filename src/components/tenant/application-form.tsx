"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { submitApplication, type ActionState } from "@/lib/actions/tenant";
import { buttonClass, Field, inputClass } from "@/components/ui";

const INITIAL: ActionState = { status: "idle" };

type Org = { id: string; name: string };
type Property = { id: string; org_id: string; name: string };
type Unit = { id: string; org_id: string; property_id: string; unit_number: string; type: string };

export function ApplicationForm({
  organisations,
  properties,
  units,
}: {
  organisations: Org[];
  properties: Property[];
  units: Unit[];
}) {
  const [state, action] = useActionState(submitApplication, INITIAL);
  const [orgId, setOrgId] = useState(organisations[0]?.id ?? "");
  const [propertyId, setPropertyId] = useState("");
  const [isCompany, setIsCompany] = useState(false);

  // Cascade the pickers so you cannot apply for a unit at another estate.
  const orgProperties = properties.filter((p) => p.org_id === orgId);
  const availableUnits = units.filter(
    (u) => u.org_id === orgId && (!propertyId || u.property_id === propertyId),
  );

  if (state.status === "success") {
    return (
      <div className="py-6 text-center">
        <p className="text-sm font-medium text-brand-700">{state.message}</p>
        <a href="/apply" className={`${buttonClass("secondary")} mt-4`}>
          Apply for another
        </a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3">
      <Field label="Estate">
        <select
          name="org_id"
          value={orgId}
          onChange={(e) => {
            setOrgId(e.target.value);
            setPropertyId("");
          }}
          required
          className={inputClass}
        >
          {organisations.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Property">
        <select
          name="property_id"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
          className={inputClass}
        >
          <option value="">No preference</option>
          {orgProperties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Specific unit" hint="Optional. Leave blank to be matched to what is free.">
        <select name="unit_id" className={inputClass} defaultValue="">
          <option value="">No preference</option>
          {availableUnits.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.unit_number}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Space type">
          <select name="requested_type" className={inputClass} defaultValue="apartment">
            <option value="apartment">Apartment</option>
            <option value="house">House</option>
            <option value="townhouse">Townhouse</option>
            <option value="office">Office</option>
            <option value="retail_store">Retail store</option>
            <option value="storage">Storage</option>
          </select>
        </Field>
        <Field label="Move-in date">
          <input name="desired_move_in" type="date" className={inputClass} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Lease term (months)">
          <input
            name="lease_term_months"
            type="number"
            min="1"
            max="120"
            defaultValue="12"
            className={inputClass}
          />
        </Field>
        <Field label="Occupants">
          <input name="occupants" type="number" min="1" defaultValue="1" className={inputClass} />
        </Field>
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="is_company"
          checked={isCompany}
          onChange={(e) => setIsCompany(e.target.checked)}
          className="text-brand-600 focus:ring-brand-500 rounded border-slate-300"
        />
        Applying as a business
      </label>

      {isCompany ? (
        <>
          <Field label="Company name">
            <input name="company_name" className={inputClass} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Registration number">
              <input name="company_reg_no" className={inputClass} />
            </Field>
            <Field label="Trading type">
              <input name="trading_type" className={inputClass} placeholder="Coffee shop" />
            </Field>
          </div>
        </>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Monthly income">
              <input
                name="monthly_income"
                type="number"
                step="0.01"
                min="0"
                className={inputClass}
              />
            </Field>
            <Field label="Employment">
              <select name="employment_type" className={inputClass} defaultValue="permanent">
                <option value="permanent">Permanent</option>
                <option value="contract">Contract</option>
                <option value="self_employed">Self employed</option>
                <option value="student">Student</option>
                <option value="retired">Retired</option>
                <option value="unemployed">Unemployed</option>
              </select>
            </Field>
          </div>
          <Field label="Employer">
            <input name="employer" className={inputClass} />
          </Field>
        </>
      )}

      <label className="flex items-center gap-2 text-sm text-slate-700">
        <input
          type="checkbox"
          name="has_pets"
          className="text-brand-600 focus:ring-brand-500 rounded border-slate-300"
        />
        I have pets
      </label>

      <Field label="Pet details">
        <input name="pet_detail" className={inputClass} placeholder="One small dog" />
      </Field>

      <Field label="Anything else?">
        <textarea name="motivation" rows={3} className={inputClass} />
      </Field>

      {state.status === "error" && (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
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
      {pending ? "Submitting…" : "Submit application"}
    </button>
  );
}
