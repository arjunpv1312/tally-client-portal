"use client";

import { Download, FileText } from "lucide-react";
import { toast } from "sonner";

export type ExportValue = string | number | null | undefined;
export type ExportRow = Record<string, ExportValue>;

type ExportButtonsProps = {
  rows: ExportRow[];
  filename: string;
  reportTitle: string;
};

function csvCell(value: ExportValue) {
  let text = value == null ? "" : String(value);
  if (/^[\s]*[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

export function ExportButtons({
  rows,
  filename,
  reportTitle,
}: ExportButtonsProps) {
  function exportCsv() {
    if (rows.length === 0) {
      toast.error("There is no data in this date range to export.");
      return;
    }
    const columns = Object.keys(rows[0]);
    const content = [
      ["FINORA", reportTitle].map(csvCell).join(","),
      ["Generated", new Date().toLocaleString()].map(csvCell).join(","),
      "",
      columns.map(csvCell).join(","),
      ...rows.map((row) => columns.map((column) => csvCell(row[column])).join(",")),
    ].join("\r\n");
    const blob = new Blob(["\uFEFF", content], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
    <div className="hidden print:block">
      <p className="text-xl font-bold tracking-[0.18em]">FINORA</p>
      <p className="text-sm">{reportTitle}</p>
    </div>
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        type="button"
        onClick={() => window.print()}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <FileText className="h-4 w-4" />
        Export to PDF
      </button>
      <button
        type="button"
        onClick={exportCsv}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-200 px-3 text-sm font-medium text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <Download className="h-4 w-4" />
        Export to CSV
      </button>
    </div>
    </>
  );
}
