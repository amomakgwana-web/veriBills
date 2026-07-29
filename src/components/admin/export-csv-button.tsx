"use client";

import { buttonClass } from "@/components/ui";

function toCsvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function ExportCsvButton({
  filename,
  headers,
  rows,
}: {
  filename: string;
  headers: string[];
  rows: Array<Array<string | number>>;
}) {
  return (
    <button
      type="button"
      className={buttonClass("secondary", "sm")}
      onClick={() => {
        const csv = [headers, ...rows]
          .map((row) => row.map(toCsvCell).join(","))
          .join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        link.click();
        URL.revokeObjectURL(url);
      }}
    >
      Export CSV
    </button>
  );
}
