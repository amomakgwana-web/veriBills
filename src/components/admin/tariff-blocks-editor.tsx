"use client";

import { useState } from "react";

import { buttonClass, inputClass } from "@/components/ui";

export type BlockRow = { from: string; to: string; rate: string };

export function TariffBlocksEditor({
  name = "blocks",
  initial,
}: {
  name?: string;
  initial?: BlockRow[];
}) {
  const [rows, setRows] = useState<BlockRow[]>(
    initial && initial.length > 0 ? initial : [{ from: "0", to: "", rate: "" }],
  );

  const update = (i: number, field: keyof BlockRow, value: string) => {
    setRows((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  };

  const addRow = () => {
    const last = rows[rows.length - 1];
    setRows((prev) => [...prev, { from: last?.to ?? "", to: "", rate: "" }]);
  };

  const removeRow = (i: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, idx) => idx !== i) : prev));
  };

  // The action parses this JSON server-side; a native form can't submit a
  // variable number of same-named rows any other way without extra plumbing.
  const json = JSON.stringify(
    rows.map((r) => ({ from: r.from, to: r.to === "" ? null : r.to, rate: r.rate })),
  );

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={json} />
      <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 text-xs font-medium text-slate-500">
        <span>From</span>
        <span>To (blank = open-ended)</span>
        <span>Rate per unit</span>
        <span />
      </div>
      {rows.map((row, i) => (
        <div key={i} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
          <input
            type="number"
            step="0.001"
            min="0"
            value={row.from}
            onChange={(e) => update(i, "from", e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            step="0.001"
            min="0"
            placeholder="∞"
            value={row.to}
            onChange={(e) => update(i, "to", e.target.value)}
            className={inputClass}
          />
          <input
            type="number"
            step="0.000001"
            min="0"
            required
            value={row.rate}
            onChange={(e) => update(i, "rate", e.target.value)}
            className={inputClass}
          />
          <button
            type="button"
            onClick={() => removeRow(i)}
            disabled={rows.length === 1}
            className={buttonClass("ghost", "sm")}
          >
            ✕
          </button>
        </div>
      ))}
      <button type="button" onClick={addRow} className={buttonClass("secondary", "sm")}>
        + Add block
      </button>
    </div>
  );
}
