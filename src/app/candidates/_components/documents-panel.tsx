"use client";

import { useRef, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Icon,
  Label,
  Modal,
  Select,
  cn,
  useToast,
  type DataTableColumn,
} from "@/components/ui";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_CATEGORY_LABELS,
  type DocumentCategory,
} from "@/lib/data/types";
import { parseResumeFileAction } from "@/app/matchmaker/ai-actions";
import type { ParsedResume } from "@/app/matchmaker/resume-parser";
import { getDocumentSignedUrl, uploadDocument } from "../_lib/documents-actions";
import type { DocumentView } from "../_lib/view-types";

/** NEXT_PUBLIC_* is inlined at build time, so this is safe in a client component. */
const AI_ON = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

/** Filename that opens a short-lived signed URL on click. */
function DownloadName({ doc }: { doc: DocumentView }) {
  const toast = useToast();
  const [pending, start] = useTransition();
  function open() {
    start(async () => {
      const res = await getDocumentSignedUrl(doc.id);
      if (res.url) window.open(res.url, "_blank", "noopener,noreferrer");
      else toast.error(res.error ?? "Could not open that file.");
    });
  }
  return (
    <button
      type="button"
      onClick={open}
      disabled={pending}
      className="inline-flex items-center gap-1.5 font-semibold text-slate-800 outline-none hover:text-primary focus-visible:underline disabled:opacity-60"
    >
      <Icon name="document" size={15} className="shrink-0 text-slate-500" />
      {doc.fileName}
    </button>
  );
}

const columns: ReadonlyArray<DataTableColumn<DocumentView>> = [
  {
    key: "file",
    header: "File",
    cell: (d) => <DownloadName doc={d} />,
    sortValue: (d) => d.fileName,
  },
  {
    key: "category",
    header: "Category",
    cell: (d) => <Badge>{d.categoryLabel}</Badge>,
    sortValue: (d) => d.categoryLabel,
  },
  {
    key: "uploaded",
    header: "Uploaded",
    cell: (d) => <span className="text-slate-500">{d.when}</span>,
    sortValue: (d) => d.when,
  },
  {
    key: "by",
    header: "By",
    cell: (d) => <span className="text-slate-500">{d.uploadedBy}</span>,
    sortValue: (d) => d.uploadedBy,
  },
];

export function DocumentsPanel({
  candidateId,
  documents,
}: {
  candidateId: string;
  documents: DocumentView[];
}) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<DocumentCategory>("resume");
  const [dragOver, setDragOver] = useState(false);
  const [pending, start] = useTransition();

  // AI resume extraction (flag-gated, non-blocking, dismissible).
  const [extractDocId, setExtractDocId] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ParsedResume | null>(null);

  function submit(file: File) {
    const fd = new FormData();
    fd.set("candidate_id", candidateId);
    fd.set("category", category);
    fd.set("file", file);
    const wasResume = category === "resume";
    start(async () => {
      const res = await uploadDocument(fd);
      if (res.ok) {
        toast.success(`Uploaded “${file.name}”.`);
        // Offer an optional AI extraction for resume uploads only.
        if (AI_ON && wasResume && res.documentId) setExtractDocId(res.documentId);
      } else {
        toast.error(res.error ?? "Upload failed.");
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function runExtraction() {
    if (!extractDocId) return;
    setExtracting(true);
    void parseResumeFileAction(candidateId, extractDocId).then((res) => {
      setExtracting(false);
      setExtractDocId(null);
      if (res.ok && res.parsed) {
        setExtracted(res.parsed);
      } else {
        toast.error(res.error ?? "Could not extract skills from that resume.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Document storage</CardTitle>
        <div className="flex items-center gap-2">
          <Label htmlFor="doc-category" className="mb-0 text-[12px] text-slate-500">
            Type
          </Label>
          <Select
            id="doc-category"
            value={category}
            onChange={(e) => setCategory(e.target.value as DocumentCategory)}
            className="h-8 w-40 py-1 text-[13px]"
          >
            {DOCUMENT_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {DOCUMENT_CATEGORY_LABELS[c]}
              </option>
            ))}
          </Select>
        </div>
      </CardHeader>
      <CardBody className="space-y-3">
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload a document — drop a file or press Enter to choose"
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files?.[0];
            if (file) submit(file);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-card border-2 border-dashed px-4 py-8 text-center outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-primary-soft",
            dragOver
              ? "border-primary bg-primary-faint"
              : "border-slate-300 hover:border-slate-400 hover:bg-slate-50",
            pending && "pointer-events-none opacity-60",
          )}
        >
          <Icon name="doc" size={22} className="text-slate-400" />
          <p className="text-[13px] font-semibold text-slate-700">
            {pending ? "Uploading…" : "Drop a file here, or click to choose"}
          </p>
          <p className="text-[12px] text-slate-500">
            PDF, Word, image or text · up to 10 MB
          </p>
          <input
            ref={inputRef}
            type="file"
            className="sr-only"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) submit(file);
            }}
          />
        </div>

        {AI_ON && extractDocId ? (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-card border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-[13px] text-slate-600">
              Extract skills from this resume?
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={runExtraction} loading={extracting}>
                Extract skills
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExtractDocId(null)}
                disabled={extracting}
              >
                Dismiss
              </Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={documents}
          rowKey={(d) => d.id}
          dense
          ariaLabel="Candidate documents"
          empty={
            <EmptyState
              icon={<Icon name="document" size={20} />}
              title="No documents yet"
              hint="Upload a résumé, certification, or offer letter above."
            />
          }
        />
      </CardBody>

      <Modal
        open={extracted !== null}
        onClose={() => setExtracted(null)}
        title="Extracted from resume"
        footer={
          <Button onClick={() => setExtracted(null)}>Done</Button>
        }
      >
        {extracted ? (
          <div className="space-y-4 text-[13.5px]">
            <p className="text-[12px] text-slate-500">
              Read from the uploaded resume by AI — review before relying on it.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="mb-0 text-[12px] text-slate-500">Name</Label>
                <p className="font-medium text-slate-800">{extracted.name}</p>
              </div>
              <div>
                <Label className="mb-0 text-[12px] text-slate-500">Years of experience</Label>
                <p className="font-medium text-slate-800">{extracted.yearsExp}</p>
              </div>
            </div>
            <div>
              <Label className="mb-1 text-[12px] text-slate-500">Skills</Label>
              {extracted.skills.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {extracted.skills.map((s) => (
                    <Badge key={s.skill}>
                      {s.skill}
                      {s.years > 0 ? ` · ${s.years}y` : ""}
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-slate-500">None detected.</p>
              )}
            </div>
            {extracted.certifications.length > 0 ? (
              <div>
                <Label className="mb-1 text-[12px] text-slate-500">Certifications</Label>
                <div className="flex flex-wrap gap-1.5">
                  {extracted.certifications.map((c) => (
                    <Badge key={c}>{c}</Badge>
                  ))}
                </div>
              </div>
            ) : null}
            {extracted.summary ? (
              <div>
                <Label className="mb-1 text-[12px] text-slate-500">Summary</Label>
                <p className="text-slate-700">{extracted.summary}</p>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </Card>
  );
}
