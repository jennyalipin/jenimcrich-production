"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Papa from "papaparse";
import { Button, Icon, Modal, useToast } from "@/components/ui";
import { importCandidates } from "../_lib/import-actions";

interface ParsedRow {
  name: string;
  email: string;
  phone: string;
  location: string;
  source: string;
  yearsExp: number;
  summary: string;
  skills: { skill: string; years: number }[];
  certifications: string[];
  tags: string[];
}

/** Read a column case-insensitively, trying several header aliases. */
function pick(row: Record<string, string>, aliases: string[]): string {
  for (const key of Object.keys(row)) {
    if (aliases.includes(key.trim().toLowerCase())) return (row[key] ?? "").trim();
  }
  return "";
}

/** "Kiln Management (11y); HSE (8y)" → [{skill, years}]. */
function parseSkills(raw: string): { skill: string; years: number }[] {
  return raw
    .split(/;/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => {
      const m = s.match(/^(.*?)\s*\((\d+)\s*y?\)$/i);
      return m ? { skill: m[1].trim(), years: Number(m[2]) } : { skill: s, years: 0 };
    })
    .filter((s) => s.skill.length > 0);
}

function splitList(raw: string): string[] {
  return raw
    .split(/;/)
    .map((s) => s.trim())
    .filter(Boolean);
}

export function ImportCandidatesButton() {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<ParsedRow[] | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const toast = useToast();

  function reset() {
    setRows(null);
    setFileName("");
    setError(null);
  }

  function handleFile(file: File) {
    reset();
    setFileName(file.name);
    Papa.parse<Record<string, string>>(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const parsed: ParsedRow[] = result.data
          .map((r) => ({
            name: pick(r, ["name", "full name", "candidate", "candidate name"]),
            email: pick(r, ["email", "email address"]),
            phone: pick(r, ["phone", "phone number", "mobile"]),
            location: pick(r, ["location", "city", "based in"]),
            source: pick(r, ["source"]),
            yearsExp: Number(pick(r, ["years experience", "years", "experience", "years exp"])) || 0,
            summary: pick(r, ["summary", "notes", "about"]),
            skills: parseSkills(pick(r, ["top skills", "skills"])),
            certifications: splitList(pick(r, ["certifications", "certs"])),
            tags: splitList(pick(r, ["tags", "tag"])),
          }))
          .filter((r) => r.name.length > 0);
        if (parsed.length === 0) {
          setError("No rows found. Make sure your CSV has a 'Name' column header.");
          return;
        }
        setRows(parsed);
      },
      error: () => setError("Couldn't read that file. Make sure it's a valid CSV."),
    });
  }

  function handleImport() {
    if (!rows) return;
    start(async () => {
      const res = await importCandidates(rows);
      if (res.imported === 0 && res.errors > 0) {
        toast.error("Import failed — check the file format and try again.");
        return;
      }
      const parts = [`Imported ${res.imported}`];
      if (res.skipped) parts.push(`skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}`);
      if (res.errors) parts.push(`${res.errors} error${res.errors === 1 ? "" : "s"}`);
      toast.success(`${parts.join(" · ")}.`);
      setOpen(false);
      reset();
      router.refresh();
    });
  }

  return (
    <>
      <Button variant="ghost" size="sm" onClick={() => setOpen(true)}>
        <Icon name="document" size={14} /> Import CSV
      </Button>

      {open ? (
        <Modal
          open
          onClose={() => {
            if (!pending) {
              setOpen(false);
              reset();
            }
          }}
          title="Import candidates from CSV"
          footer={
            <>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                  reset();
                }}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button onClick={handleImport} loading={pending} disabled={!rows || rows.length === 0}>
                {rows ? `Import ${rows.length} candidate${rows.length === 1 ? "" : "s"}` : "Import"}
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <p className="text-[13px] leading-relaxed text-slate-600">
              Upload a CSV with a <span className="font-semibold text-ink">Name</span> column.
              Optional columns: Email, Phone, Location, Source, Years experience, Summary, Skills,
              Certifications, Tags. The list you{" "}
              <span className="font-semibold text-ink">Export CSV</span> drops straight back in.
            </p>

            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-card border border-dashed border-slate-300 bg-slate-50 px-6 py-8 text-center transition-colors hover:border-primary hover:bg-primary-faint">
              <Icon name="document" size={24} className="text-slate-400" />
              <span className="text-[13px] font-medium text-slate-700">
                {fileName || "Choose a CSV file"}
              </span>
              <span className="text-[12px] text-slate-400">Click to browse, or drag a file here</span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </label>

            {error ? (
              <p className="rounded-control bg-danger-soft px-3 py-2 text-[12.5px] text-danger-ink">
                {error}
              </p>
            ) : null}

            {rows && rows.length > 0 ? (
              <div className="rounded-card border border-slate-200 bg-surface p-3">
                <p className="text-[13px] font-semibold text-ink">
                  {rows.length} candidate{rows.length === 1 ? "" : "s"} ready to import
                </p>
                <p className="mt-1 text-[12px] text-slate-500">
                  e.g. {rows.slice(0, 3).map((r) => r.name).join(", ")}
                  {rows.length > 3 ? ", …" : ""}
                </p>
                <p className="mt-2 text-[11.5px] text-slate-400">
                  Candidates with an email already in the system are skipped.
                </p>
              </div>
            ) : null}
          </div>
        </Modal>
      ) : null}
    </>
  );
}
