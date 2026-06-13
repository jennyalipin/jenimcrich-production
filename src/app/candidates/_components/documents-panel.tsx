"use client";

import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  DataTable,
  EmptyState,
  type DataTableColumn,
} from "@/components/ui";
import type { DocumentView } from "../_lib/view-types";

const columns: ReadonlyArray<DataTableColumn<DocumentView>> = [
  {
    key: "file",
    header: "File",
    cell: (d) => (
      <span className="font-semibold text-slate-800">
        <span aria-hidden="true">📄</span> {d.fileName}
      </span>
    ),
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

/**
 * Documents tab — list only for now. Uploads and downloads need the private
 * Supabase Storage bucket (signed URLs), which is not provisioned yet.
 */
export function DocumentsPanel({ documents }: { documents: DocumentView[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Document storage</CardTitle>
        <Button
          size="sm"
          disabled
          title="Available once Supabase Storage is connected"
        >
          + Upload file
        </Button>
      </CardHeader>
      <CardBody className="space-y-3">
        <p className="rounded-control bg-warning-soft px-3 py-2 text-[12.5px] text-warning-ink">
          File uploads are off until Supabase Storage is connected. Records below come from the
          demo data layer; resumes and offers will live in a private bucket with signed-URL
          downloads.
        </p>
        <DataTable
          columns={columns}
          rows={documents}
          rowKey={(d) => d.id}
          dense
          ariaLabel="Candidate documents"
          empty={
            <EmptyState
              icon="📁"
              title="No documents on file"
              hint="Resumes, certifications and offer letters will appear here once storage is connected."
            />
          }
        />
      </CardBody>
    </Card>
  );
}
