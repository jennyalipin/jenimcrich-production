"use client";

import { useState } from "react";
import { Button, Icon, useToast } from "@/components/ui";
import type { CandidateFilters } from "@/lib/data";
import { exportCandidatesCsv } from "../_lib/export-actions";

/** Local YYYY-MM-DD for the download filename, computed on the client. */
function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/**
 * Exports the (filtered) candidate list as a CSV download. The server action
 * builds the CSV; we wrap it in a Blob and trigger the browser download.
 */
export function ExportCandidatesButton({ filters }: { filters?: CandidateFilters }) {
  const [exporting, setExporting] = useState(false);
  const toast = useToast();

  async function handleExport() {
    setExporting(true);
    try {
      const csv = await exportCandidatesCsv(filters);
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `candidates-${today()}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Couldn't export the candidate list. Please try again.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button variant="ghost" size="md" loading={exporting} onClick={handleExport}>
      {exporting ? null : <Icon name="document" size={15} />}
      Export CSV
    </Button>
  );
}
