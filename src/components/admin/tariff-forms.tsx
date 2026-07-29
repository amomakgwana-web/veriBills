"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import {
  createTariff,
  replaceTariffBlocks,
  setTariffActive,
  type ActionState,
} from "@/lib/actions/admin";
import { buttonClass, Field, inputClass, labelClass } from "@/components/ui";
import { TariffBlocksEditor, type BlockRow } from "@/components/admin/tariff-blocks-editor";

const INITIAL: ActionState = { status: "idle" };

const UTILITIES = [
  { value: "water", label: "Water" },
  { value: "electricity_prepaid", label: "Electricity (prepaid)" },
  { value: "electricity_conventional", label: "Electricity (conventional)" },
];

export function NewTariffForm({ orgs }: { orgs: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(createTariff, INITIAL);

  return (
    <form action={action} className="space-y-3">
      <Field label="Organisation">
        <select name="org_id" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Choose an organisation
          </option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
      </Field>

      <Field label="Name">
        <input name="name" required placeholder="Residential water — stepped" className={inputClass} />
      </Field>

      <Field label="Utility">
        <select name="utility" required defaultValue="water" className={inputClass}>
          {UTILITIES.map((u) => (
            <option key={u.value} value={u.value}>
              {u.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Fixed charge">
          <input name="fixed_charge" type="number" step="0.01" min="0" defaultValue="0" className={inputClass} />
        </Field>
        <Field label="VAT %">
          <input name="vat_rate" type="number" step="0.01" min="0" defaultValue="15" className={inputClass} />
        </Field>
        <Field label="Markup %">
          <input name="markup_percent" type="number" step="0.01" min="0" defaultValue="0" className={inputClass} />
        </Field>
      </div>

      <Field label="Effective from" hint="Defaults to today">
        <input name="effective_from" type="date" className={inputClass} />
      </Field>

      <div>
        <label className={labelClass}>Rate blocks</label>
        <TariffBlocksEditor />
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
    <button type="submit" disabled={pending} className={`${buttonClass("primary", "sm")} w-full`}>
      {pending ? "Creating…" : "Create tariff"}
    </button>
  );
}

export function EditBlocksForm({
  tariffId,
  initialBlocks,
}: {
  tariffId: string;
  initialBlocks: BlockRow[];
}) {
  const [state, action] = useActionState(replaceTariffBlocks, INITIAL);
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={buttonClass("secondary", "sm")}>
        Edit blocks
      </button>
    );
  }

  return (
    <form action={action} className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
      <input type="hidden" name="tariff_id" value={tariffId} />
      <TariffBlocksEditor initial={initialBlocks} />
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
      <div className="flex gap-2">
        <SaveButton />
        <button type="button" onClick={() => setOpen(false)} className={buttonClass("ghost", "sm")}>
          Close
        </button>
      </div>
    </form>
  );
}

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={buttonClass("primary", "sm")}>
      {pending ? "Saving…" : "Save blocks"}
    </button>
  );
}

export function TariffActiveToggle({ tariffId, isActive }: { tariffId: string; isActive: boolean }) {
  const [state, action] = useActionState(setTariffActive, INITIAL);

  return (
    <form action={action} className="inline-block">
      <input type="hidden" name="tariff_id" value={tariffId} />
      <input type="hidden" name="is_active" value={(!isActive).toString()} />
      <ToggleButton isActive={isActive} />
      {state.status === "error" && (
        <span role="alert" className="ml-1.5 text-xs text-red-600">
          {state.message}
        </span>
      )}
    </form>
  );
}

function ToggleButton({ isActive }: { isActive: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(isActive ? "secondary" : "primary", "sm")}
    >
      {pending ? "Saving…" : isActive ? "Deactivate" : "Activate"}
    </button>
  );
}
