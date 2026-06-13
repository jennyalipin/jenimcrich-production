"use client";

import { useRef, useState, useTransition } from "react";
import {
  Badge,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  Icon,
  Label,
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
import { getDocumentSignedUrl, uploadDocument } from "../_lib/documents-actions";
import type { DocumentView } from "../_lib/view-types";

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

  function submit(file: File) {
    const fd = new FormData();
    fd.set("candidate_id", candidateId);
    fd.set("category", category);
    fd.set("file", file);
    start(async () => {
      const res = await uploadDocument(fd);
      if (res.ok) toast.success(`Uploaded “${file.name}”.`);
      else toast.error(res.error ?? "Upload failed.");
      if (inputRef.current) inputRef.current.value = "";
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
    </Card>
  );
}
