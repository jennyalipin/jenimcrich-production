"use client";

import { useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  FieldError,
  Icon,
  Input,
  Label,
  Modal,
  Select,
  StageBadge,
  Textarea,
  useToast,
  type BadgeVariant,
} from "@/components/ui";
import { AnimatedTrash } from "@/components/ui/animated-trash";
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_LABELS,
  type Stage,
  type TemplateCategory,
} from "@/lib/data/types";
import {
  MERGE_FIELDS,
  UnknownMergeFieldError,
  mergeTemplate,
  validateTemplate,
  type MergeField,
  type MergeValues,
} from "@/lib/merge";
import {
  deleteTemplateAction,
  importTemplatesAction,
  saveTemplateAction,
  type SavedTemplate,
} from "./actions";
import { draftTemplateWithAI } from "./ai-actions";

// NEXT_PUBLIC_* is inlined at build; off by default → no AI button renders.
const TEMPLATES_AI_ON = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

/* ------------------------------ plain props ------------------------------ */

export interface TemplateRecord {
  id: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
}

export interface RecipientOption {
  id: string;
  name: string;
  email: string;
  /** Current pipeline stage of the candidate's primary application. */
  stage: Stage | null;
  /** Pre-computed merge values for previews (rule 6). */
  values: MergeValues;
}

export interface EmailLogRow {
  id: string;
  /** Pre-formatted timestamp (deterministic SSR). */
  when: string;
  to: string;
  subject: string;
  status: string;
}

interface TemplatesViewProps {
  templates: TemplateRecord[];
  recipients: RecipientOption[];
  emailLog: EmailLogRow[];
}

/* ------------------------------- helpers ------------------------------- */

const CATEGORY_BADGE: Record<TemplateCategory, BadgeVariant> = {
  interview: "info",
  rejection: "danger",
  offer: "warning",
  update: "default",
};

function emailStatusVariant(status: string): BadgeVariant {
  if (status === "bounced") return "danger";
  if (status === "queued") return "default";
  return "success";
}

/** Used when no candidates exist yet, so the live preview always works. */
const FALLBACK_SAMPLE: MergeValues = {
  candidate_name: "Alex Sample",
  stage: "Interview",
  job_title: "Plant Manager – Cement",
  client: "Helix Cement Corp",
  recruiter_name: "Jenny M.",
  interview_date: null,
};

/** Human-readable problem with a template's merge fields, or null. */
function templateIssue(text: string): string | null {
  try {
    validateTemplate(text);
    return null;
  } catch (error) {
    return error instanceof UnknownMergeFieldError
      ? error.message
      : "This template could not be read.";
  }
}

/** Merge that never throws — falls back to the raw text. */
function safeMerge(text: string, values: MergeValues): string {
  try {
    return mergeTemplate(text, values);
  } catch {
    return text;
  }
}

function usedFields(template: TemplateRecord): MergeField[] {
  try {
    return validateTemplate(`${template.subject}\n${template.body}`);
  } catch {
    return [];
  }
}

const chipClass =
  "rounded border border-slate-200 bg-slate-100 px-1.5 py-0.5 font-mono text-[11px] leading-4 text-slate-600";

interface EditorDraft {
  id: string | null;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
}

/* ------------------------------ main view ------------------------------ */

export function TemplatesView({ templates: initialTemplates, recipients, emailLog }: TemplatesViewProps) {
  const toast = useToast();
  const [templates, setTemplates] = useState<TemplateRecord[]>(initialTemplates);
  const [editor, setEditor] = useState<EditorDraft | null>(null);
  const [deleting, setDeleting] = useState<TemplateRecord | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [, startDelete] = useTransition();

  // Reconcile with the database whenever the server re-renders (after a save,
  // delete, or import revalidates /templates) so ids match persisted rows.
  // React's endorsed "adjust state during render" pattern — no effect needed.
  const [syncedFrom, setSyncedFrom] = useState(initialTemplates);
  if (syncedFrom !== initialTemplates) {
    setSyncedFrom(initialTemplates);
    setTemplates(initialTemplates);
  }

  function handleSaved(saved: SavedTemplate) {
    const isUpdate = templates.some((t) => t.id === saved.id);
    setTemplates((prev) =>
      isUpdate ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved],
    );
    toast.success(isUpdate ? "Template updated." : "Template created.");
    setEditor(null);
  }

  function handleDelete() {
    if (!deleting) return;
    const target = deleting;
    setTemplates((prev) => prev.filter((t) => t.id !== target.id));
    setDeleting(null);
    startDelete(async () => {
      const res = await deleteTemplateAction(target.id);
      if (!res.ok) {
        setTemplates((prev) => [...prev, target]);
        toast.error(res.error ?? "The template could not be deleted.");
        return;
      }
      toast.success(`"${target.name}" deleted.`);
    });
  }

  return (
    <div className="space-y-5 p-6">
      {/* Header: merge-field hint + actions (Topbar owns the h1) */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px] text-slate-500">
            <span>Merge fields:</span>
            {MERGE_FIELDS.map((field) => (
              <code key={field} className={chipClass}>{`{{${field}}}`}</code>
            ))}
          </div>
          <p className="text-[12px] text-slate-500">
            Templates are saved to your library and personalize per candidate;
            bulk sending activates once email is connected.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="ghost" onClick={() => setImportOpen(true)}>
            <Icon name="document" size={15} /> Import from Gmail
          </Button>
          <Button
            variant="secondary"
            onClick={() => setBulkOpen(true)}
            disabled={templates.length === 0}
            title={
              templates.length === 0
                ? "Create a template first to send a bulk email"
                : undefined
            }
            aria-label={
              templates.length === 0
                ? "Bulk email — create a template first"
                : "Bulk email"
            }
          >
            <Icon name="email" size={15} /> Bulk email
          </Button>
          <Button onClick={() =>
            setEditor({ id: null, name: "", category: "update", subject: "", body: "" })
          }>
            + New template
          </Button>
        </div>
      </div>

      {templates.length === 0 ? (
        <Card>
          <EmptyState
            className="py-14"
            icon={<Icon name="email" size={22} className="text-slate-400" />}
            title="No templates yet"
            hint="Create your first email template — merge fields personalize it per candidate."
            action={
              <Button onClick={() =>
                setEditor({ id: null, name: "", category: "update", subject: "", body: "" })
              }>
                + New template
              </Button>
            }
          />
        </Card>
      ) : (
        TEMPLATE_CATEGORIES.map((category) => {
          const items = templates.filter((t) => t.category === category);
          if (items.length === 0) return null;
          return (
            <section key={category} className="space-y-2.5" aria-label={`${TEMPLATE_CATEGORY_LABELS[category]} templates`}>
              <h2 className="micro-label text-slate-500">
                {TEMPLATE_CATEGORY_LABELS[category]} · {items.length}
              </h2>
              <div className="grid items-stretch gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {items.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onEdit={() => setEditor({ ...template })}
                    onDelete={() => setDeleting(template)}
                  />
                ))}
              </div>
            </section>
          );
        })
      )}

      <EmailLogCard rows={emailLog} />

      {editor !== null ? (
        <TemplateEditorModal
          key={editor.id ?? "new"}
          initial={editor}
          recipients={recipients}
          onCancel={() => setEditor(null)}
          onSaved={handleSaved}
        />
      ) : null}

      {bulkOpen ? (
        <BulkComposerModal
          templates={templates}
          recipients={recipients}
          onClose={() => setBulkOpen(false)}
        />
      ) : null}

      {importOpen ? <GmailImportModal onClose={() => setImportOpen(false)} /> : null}

      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete template?"
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={handleDelete}>
              Delete template
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate-600">
          &ldquo;{deleting?.name}&rdquo; will be removed from the library.
          Emails already logged against candidates are kept.
        </p>
      </Modal>
    </div>
  );
}

/* ----------------------------- template card ----------------------------- */

function TemplateCard({
  template,
  onEdit,
  onDelete,
}: {
  template: TemplateRecord;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const fields = useMemo(() => usedFields(template), [template]);
  const bodyRef = useRef<HTMLDivElement | null>(null);
  const [bodyClipped, setBodyClipped] = useState(false);
  const [deleteHover, setDeleteHover] = useState(false);

  useEffect(() => {
    const el = bodyRef.current;
    if (!el) return;
    setBodyClipped(el.scrollHeight > el.clientHeight + 1);
  }, [template.body]);

  return (
    <Card className="flex flex-col">
      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[14px] font-semibold leading-snug text-ink">
            {template.name}
          </span>
          <Badge variant={CATEGORY_BADGE[template.category]}>
            {TEMPLATE_CATEGORY_LABELS[template.category]}
          </Badge>
        </div>
        <p className="text-[12.5px] leading-snug text-slate-600">
          <span className="font-semibold text-slate-500">Subject:</span>{" "}
          {template.subject}
        </p>
        <div
          ref={bodyRef}
          className="relative max-h-40 overflow-hidden whitespace-pre-wrap rounded-control border border-slate-100 bg-slate-50 p-3 text-[12px] leading-relaxed text-slate-600"
        >
          {template.body}
          {bodyClipped ? (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-50 to-transparent"
            />
          ) : null}
        </div>
        {fields.length > 0 ? (
          <div className="flex flex-wrap gap-1">
            {fields.map((field) => (
              <code key={field} className={chipClass}>{`{{${field}}}`}</code>
            ))}
          </div>
        ) : null}
        <div className="mt-auto flex gap-2 pt-1">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            Edit
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={onDelete}
            onMouseEnter={() => setDeleteHover(true)}
            onMouseLeave={() => setDeleteHover(false)}
          >
            <AnimatedTrash playing={deleteHover} /> Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ------------------------------ editor modal ------------------------------ */

function TemplateEditorModal({
  initial,
  recipients,
  onCancel,
  onSaved,
}: {
  initial: EditorDraft;
  recipients: RecipientOption[];
  onCancel: () => void;
  onSaved: (template: SavedTemplate) => void;
}) {
  const uid = useId();
  const [draft, setDraft] = useState<EditorDraft>(initial);
  const [formError, setFormError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [aiPending, startAi] = useTransition();
  const [aiError, setAiError] = useState<string | null>(null);
  const [sampleId, setSampleId] = useState(recipients[0]?.id ?? "");
  const subjectRef = useRef<HTMLInputElement | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement | null>(null);
  const lastFocus = useRef<"subject" | "body">("body");

  const sample =
    recipients.find((r) => r.id === sampleId)?.values ?? FALLBACK_SAMPLE;
  const subjectIssue = useMemo(() => templateIssue(draft.subject), [draft.subject]);
  const bodyIssue = useMemo(() => templateIssue(draft.body), [draft.body]);
  const mergeIssue = subjectIssue ?? bodyIssue;

  function insertMergeField(field: MergeField) {
    const token = `{{${field}}}`;
    const key = lastFocus.current;
    const target = key === "subject" ? subjectRef.current : bodyRef.current;
    if (!target) {
      setDraft((d) => ({ ...d, [key]: d[key] + token }));
      return;
    }
    const start = target.selectionStart ?? target.value.length;
    const end = target.selectionEnd ?? start;
    const next = target.value.slice(0, start) + token + target.value.slice(end);
    setDraft((d) => ({ ...d, [key]: next }));
    requestAnimationFrame(() => {
      target.focus();
      const caret = start + token.length;
      target.setSelectionRange(caret, caret);
    });
  }

  function handleSave() {
    setFormError(null);
    startTransition(async () => {
      const result = await saveTemplateAction({ ...draft });
      if (result.ok) {
        onSaved(result.template);
      } else {
        setFormError(result.error);
      }
    });
  }

  function handleAiDraft() {
    setAiError(null);
    startAi(async () => {
      const res = await draftTemplateWithAI({ purpose: draft.name, category: draft.category });
      if (res.ok) {
        setDraft((d) => ({ ...d, subject: res.subject, body: res.body }));
      } else {
        setAiError(res.error);
      }
    });
  }

  return (
    <Modal
      open
      onClose={onCancel}
      title={initial.id ? "Edit template" : "New template"}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={handleSave} loading={isPending}>
            Save template
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Form */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${uid}-name`} requiredMark>
                Name
              </Label>
              <Input
                id={`${uid}-name`}
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Interview Invitation"
              />
            </div>
            <div>
              <Label htmlFor={`${uid}-category`}>Category</Label>
              <Select
                id={`${uid}-category`}
                value={draft.category}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    category: e.target.value as TemplateCategory,
                  }))
                }
              >
                {TEMPLATE_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {TEMPLATE_CATEGORY_LABELS[category]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {TEMPLATES_AI_ON ? (
            <div className="flex flex-wrap items-center gap-2 rounded-card border border-primary-soft bg-primary-faint px-3 py-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                loading={aiPending}
                onClick={handleAiDraft}
              >
                <Icon name="bolt" size={14} /> Draft with AI
              </Button>
              <span className={`text-[12px] ${aiError ? "text-danger-ink" : "text-slate-500"}`}>
                {aiError ?? "Writes a subject & body from the name above — review before saving."}
              </span>
            </div>
          ) : null}

          <div>
            <Label htmlFor={`${uid}-subject`} requiredMark>
              Subject
            </Label>
            <Input
              id={`${uid}-subject`}
              ref={subjectRef}
              value={draft.subject}
              onChange={(e) => setDraft((d) => ({ ...d, subject: e.target.value }))}
              onFocus={() => {
                lastFocus.current = "subject";
              }}
              invalid={Boolean(subjectIssue)}
              aria-describedby={`${uid}-subject-error`}
              placeholder="Interview Invitation – {{job_title}}"
            />
            <FieldError id={`${uid}-subject-error`}>{subjectIssue}</FieldError>
          </div>

          <div>
            <Label htmlFor={`${uid}-body`} requiredMark>
              Body
            </Label>
            <Textarea
              id={`${uid}-body`}
              ref={bodyRef}
              rows={9}
              value={draft.body}
              onChange={(e) => setDraft((d) => ({ ...d, body: e.target.value }))}
              onFocus={() => {
                lastFocus.current = "body";
              }}
              invalid={Boolean(bodyIssue)}
              aria-describedby={`${uid}-body-error`}
              placeholder={"Hi {{candidate_name}},\n\n…"}
            />
            <FieldError id={`${uid}-body-error`}>{bodyIssue}</FieldError>
          </div>

          <div className="rounded-card border border-slate-200 bg-slate-50 p-3">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
              <span className="text-[13px] font-bold text-slate-700">
                Personalize with:
              </span>
              {MERGE_FIELDS.map((field) => (
                <button
                  key={field}
                  type="button"
                  onClick={() => insertMergeField(field)}
                  className="rounded-control border border-slate-200 bg-white px-2 py-1 font-mono text-[11.5px] text-slate-600 outline-none transition-colors hover:border-primary hover:bg-primary-faint hover:text-primary-ink focus-visible:ring-[3px] focus-visible:ring-primary-soft"
                >
                  {`{{${field}}}`}
                </button>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] text-slate-400">
              Click a field to insert it at the cursor — in the subject or body,
              wherever you last clicked.
            </p>
          </div>

          <FieldError>{formError}</FieldError>
        </div>

        {/* Live preview */}
        <div className="space-y-3">
          <div>
            <Label htmlFor={`${uid}-sample`}>Preview as</Label>
            <Select
              id={`${uid}-sample`}
              value={sampleId}
              onChange={(e) => setSampleId(e.target.value)}
              disabled={recipients.length === 0}
            >
              {recipients.length === 0 ? (
                <option value="">Sample candidate</option>
              ) : (
                recipients.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))
              )}
            </Select>
          </div>

          <div className="rounded-card border border-slate-200 bg-slate-50 p-4">
            <span className="micro-label text-slate-500">Live preview</span>
            {mergeIssue ? (
              <div
                role="alert"
                className="mt-2.5 rounded-control bg-danger-soft px-3 py-2.5 text-[12.5px] leading-relaxed text-danger-ink"
              >
                {mergeIssue}
              </div>
            ) : (
              <>
                <p className="mt-2.5 text-[13px] font-semibold text-ink">
                  {safeMerge(draft.subject, sample) || "(no subject yet)"}
                </p>
                <div className="mt-2 max-h-[300px] overflow-y-auto whitespace-pre-wrap text-[12.5px] leading-relaxed text-slate-600 scrollbar-slim">
                  {safeMerge(draft.body, sample) ||
                    "Start typing the body to see it rendered for a real candidate."}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------- bulk email composer --------------------------- */

function BulkComposerModal({
  templates,
  recipients,
  onClose,
}: {
  templates: TemplateRecord[];
  recipients: RecipientOption[];
  onClose: () => void;
}) {
  const uid = useId();
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [selected, setSelected] = useState<ReadonlySet<string>>(() => new Set());

  const template = templates.find((t) => t.id === templateId) ?? templates[0] ?? null;
  const chosen = recipients.filter((r) => selected.has(r.id));

  const previews = useMemo(() => {
    if (!template) return [];
    return chosen.map((recipient) => ({
      recipient,
      subject: safeMerge(template.subject, recipient.values),
      body: safeMerge(template.body, recipient.values),
    }));
  }, [template, chosen]);

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={`Bulk email${chosen.length > 0 ? ` — ${chosen.length} candidate${chosen.length === 1 ? "" : "s"}` : ""}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button disabled title="Connect Resend to enable sending">
            Send {chosen.length} email{chosen.length === 1 ? "" : "s"}
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        <div
          role="note"
          className="flex items-start gap-2.5 rounded-control border border-warning-soft bg-warning-soft px-3.5 py-2.5 text-[12.5px] leading-relaxed text-warning-ink"
        >
          <Icon name="email" size={15} className="mt-0.5 shrink-0" />
          <span>
            Sending isn&apos;t active yet — connect Resend email to send these
            messages. You can still select recipients and review every
            personalized email below.
          </span>
        </div>

        <div>
          <Label htmlFor={`${uid}-template`}>Template</Label>
          <Select
            id={`${uid}-template`}
            value={template?.id ?? ""}
            onChange={(e) => setTemplateId(e.target.value)}
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name} ({TEMPLATE_CATEGORY_LABELS[t.category]})
              </option>
            ))}
          </Select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <span className="micro-label text-slate-600">
              Recipients · {chosen.length} of {recipients.length} selected
            </span>
            <span className="flex gap-3 text-[12px]">
              <button
                type="button"
                className="font-medium text-primary hover:underline"
                onClick={() => setSelected(new Set(recipients.map((r) => r.id)))}
              >
                Select all
              </button>
              <button
                type="button"
                className="font-medium text-slate-500 hover:underline"
                onClick={() => setSelected(new Set())}
              >
                Clear
              </button>
            </span>
          </div>
          {recipients.length === 0 ? (
            <div className="rounded-control border border-dashed border-slate-300 p-4 text-center text-[12.5px] text-slate-400">
              No candidates in the pipeline yet.
            </div>
          ) : (
            <div className="max-h-44 divide-y divide-slate-100 overflow-y-auto rounded-control border border-slate-200 scrollbar-slim">
              {/* Native checkbox here on purpose: the recipient list is
                 unbounded (scales with candidate count), so per-row Lottie
                 players would not scale. Animated checkboxes are reserved for
                 the bounded filter list. */}
              {recipients.map((r) => (
                <label
                  key={r.id}
                  className="flex cursor-pointer items-center gap-2.5 px-3 py-2 text-[13px] transition-colors hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    className="size-3.5 accent-primary"
                    checked={selected.has(r.id)}
                    onChange={() => toggle(r.id)}
                  />
                  <span className="font-medium text-slate-700">{r.name}</span>
                  {r.stage ? <StageBadge stage={r.stage} /> : null}
                  <span className="ml-auto truncate text-[12px] text-slate-400">
                    {r.email}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="micro-label text-slate-600">Per-recipient preview</h3>
          <p className="mt-0.5 text-[12px] text-slate-400">
            Every email is personalized with the candidate&apos;s merge values
            — review each one before sending.
          </p>
          {previews.length === 0 ? (
            <div className="mt-2.5 rounded-control border border-dashed border-slate-300 p-5 text-center text-[12.5px] text-slate-400">
              Select recipients above to preview their personalized emails.
            </div>
          ) : (
            <ul className="mt-2.5 space-y-2.5">
              {previews.map(({ recipient, subject, body }) => (
                <li
                  key={recipient.id}
                  className="rounded-control border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-[12.5px] font-semibold text-slate-700">
                      {recipient.name} &lt;{recipient.email}&gt;
                    </span>
                    <button
                      type="button"
                      className="shrink-0 text-[12px] font-medium text-danger hover:underline"
                      onClick={() => toggle(recipient.id)}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-1.5 text-[12.5px] font-semibold text-ink">{subject}</p>
                  <div className="mt-1.5 max-h-28 overflow-y-auto whitespace-pre-wrap text-[12px] leading-relaxed text-slate-600 scrollbar-slim">
                    {body}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* --------------------------- gmail paste import --------------------------- */

interface StagedTemplate {
  key: string;
  name: string;
  category: TemplateCategory;
  subject: string;
  body: string;
}

/**
 * No-OAuth path for bringing Gmail canned responses over: paste one in, we lift
 * the `Subject:` line if present, stage it, repeat, then import the batch.
 */
function GmailImportModal({ onClose }: { onClose: () => void }) {
  const uid = useId();
  const toast = useToast();
  const router = useRouter();
  const [pending, start] = useTransition();
  const [name, setName] = useState("");
  const [category, setCategory] = useState<TemplateCategory>("update");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [staged, setStaged] = useState<StagedTemplate[]>([]);
  const counter = useRef(0);

  const canAdd = name.trim() !== "" && subject.trim() !== "" && body.trim() !== "";

  /** Lift a leading "Subject: …" line out of pasted Gmail text. */
  function handleBodyPaste(e: React.ClipboardEvent<HTMLTextAreaElement>) {
    const text = e.clipboardData.getData("text");
    const match = text.match(/^[ \t]*subject[ \t]*:[ \t]*(.+)$/im);
    if (!match) return; // let the browser paste normally
    e.preventDefault();
    const detected = match[1].trim();
    if (!subject.trim()) setSubject(detected);
    if (!name.trim()) setName(detected);
    setBody(text.replace(/^[ \t]*subject[ \t]*:[ \t]*.+$/im, "").trim());
  }

  function addToList() {
    if (!canAdd) {
      toast.error("Add a name, subject, and body before adding to the list.");
      return;
    }
    counter.current += 1;
    setStaged((prev) => [
      ...prev,
      {
        key: `stage-${counter.current}`,
        name: name.trim(),
        category,
        subject: subject.trim(),
        body: body.trim(),
      },
    ]);
    setName("");
    setSubject("");
    setBody("");
    setCategory("update");
  }

  function removeStaged(key: string) {
    setStaged((prev) => prev.filter((s) => s.key !== key));
  }

  function runImport() {
    if (staged.length === 0) return;
    start(async () => {
      const res = await importTemplatesAction(
        staged.map(({ name, category, subject, body }) => ({ name, category, subject, body })),
      );
      if (res.imported === 0 && res.errors > 0) {
        toast.error("Import failed — check the templates and try again.");
        return;
      }
      const parts = [`Imported ${res.imported}`];
      if (res.skipped) {
        parts.push(`skipped ${res.skipped} duplicate${res.skipped === 1 ? "" : "s"}`);
      }
      toast.success(`${parts.join(" · ")}.`);
      router.refresh();
      onClose();
    });
  }

  return (
    <Modal
      open
      onClose={() => {
        if (!pending) onClose();
      }}
      title="Import templates from Gmail"
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={runImport} loading={pending} disabled={staged.length === 0}>
            {staged.length > 0
              ? `Import ${staged.length} template${staged.length === 1 ? "" : "s"}`
              : "Import"}
          </Button>
        </>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Paste form */}
        <div className="space-y-4">
          <p className="text-[12.5px] leading-relaxed text-slate-600">
            In Gmail, open a canned response or saved email and copy it. Paste it
            below — if the text starts with a{" "}
            <code className={chipClass}>Subject:</code> line we&apos;ll detect it.
            Add as many as you like, then import them all at once.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${uid}-name`} requiredMark>
                Name
              </Label>
              <Input
                id={`${uid}-name`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Phone screen invite"
              />
            </div>
            <div>
              <Label htmlFor={`${uid}-category`}>Category</Label>
              <Select
                id={`${uid}-category`}
                value={category}
                onChange={(e) => setCategory(e.target.value as TemplateCategory)}
              >
                {TEMPLATE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {TEMPLATE_CATEGORY_LABELS[c]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor={`${uid}-subject`} requiredMark>
              Subject
            </Label>
            <Input
              id={`${uid}-subject`}
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Interview invitation"
            />
          </div>

          <div>
            <Label htmlFor={`${uid}-body`} requiredMark>
              Body
            </Label>
            <Textarea
              id={`${uid}-body`}
              rows={8}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onPaste={handleBodyPaste}
              placeholder="Paste the email text here…"
            />
            <p className="mt-1 text-[11.5px] text-slate-400">
              Tip: add <code className={chipClass}>{"{{candidate_name}}"}</code> and
              other merge fields after importing to personalize it.
            </p>
          </div>

          <Button variant="secondary" onClick={addToList} disabled={!canAdd}>
            + Add to import list
          </Button>
        </div>

        {/* Staged list */}
        <div className="space-y-2">
          <span className="micro-label text-slate-500">
            Ready to import · {staged.length}
          </span>
          {staged.length === 0 ? (
            <div className="rounded-card border border-dashed border-slate-300 p-6 text-center text-[12.5px] text-slate-400">
              Templates you add appear here. Nothing is saved until you import.
            </div>
          ) : (
            <ul className="space-y-2">
              {staged.map((s) => (
                <li
                  key={s.key}
                  className="rounded-control border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-semibold text-ink">{s.name}</span>
                    <button
                      type="button"
                      className="shrink-0 text-[12px] font-medium text-danger hover:underline"
                      onClick={() => removeStaged(s.key)}
                    >
                      Remove
                    </button>
                  </div>
                  <p className="mt-0.5 text-[12px] text-slate-500">
                    <span className="font-medium">Subject:</span> {s.subject}
                  </p>
                  <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-slate-500">
                    {s.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Modal>
  );
}

/* ------------------------------ email log ------------------------------ */

function EmailLogCard({ rows }: { rows: EmailLogRow[] }) {
  const shown = Math.min(rows.length, 15);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sent email log</CardTitle>
        <Badge>
          {rows.length > 15
            ? `Showing ${shown} of ${rows.length}`
            : `${rows.length} logged`}
        </Badge>
      </CardHeader>
      {rows.length === 0 ? (
        <EmptyState
          className="py-12"
          icon={<Icon name="empty" size={22} className="text-slate-400" />}
          title="No emails logged yet"
          hint="Bulk sends and interview confirmations will appear here."
        />
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="border-b border-slate-200 text-left">
                  <th scope="col" className="micro-label px-5 py-2.5 text-slate-500">
                    When
                  </th>
                  <th scope="col" className="micro-label px-5 py-2.5 text-slate-500">
                    To
                  </th>
                  <th scope="col" className="micro-label px-5 py-2.5 text-slate-500">
                    Subject
                  </th>
                  <th scope="col" className="micro-label px-5 py-2.5 text-slate-500">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 15).map((row) => (
                  <tr key={row.id} className="border-b border-slate-100 last:border-0">
                    <td className="whitespace-nowrap px-5 py-2.5 text-slate-500">
                      {row.when}
                    </td>
                    <td className="whitespace-nowrap px-5 py-2.5 text-slate-600">
                      {row.to}
                    </td>
                    <td className="px-5 py-2.5 text-slate-700">{row.subject}</td>
                    <td className="px-5 py-2.5">
                      <Badge variant={emailStatusVariant(row.status)} className="capitalize">
                        {row.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 15 ? (
            <div className="border-t border-slate-100 px-5 py-2.5 text-[12px] text-slate-400">
              Only the 15 most recent emails are shown here.
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
