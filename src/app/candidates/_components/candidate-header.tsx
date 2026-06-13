"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  Input,
  Modal,
  ScorePill,
  Select,
  StageBadge,
  cn,
  useToast,
} from "@/components/ui";
import { initials } from "@/lib/format";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/data/types";
import { addTag, removeTag, setArchived, toggleFlag, updateApplicationStage } from "../actions";
import type { CandidateHeaderData } from "../_lib/view-types";

/**
 * Profile header: identity, flag toggle, tags editor, match/interview pills,
 * stage control for the primary application, archive/restore.
 */
export function CandidateHeader({ data }: { data: CandidateHeaderData }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  const [stage, setStage] = useState<Stage>(data.primary?.stage ?? "applied");
  const [tagInput, setTagInput] = useState("");
  const [tagOpen, setTagOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  function onToggleFlag() {
    startTransition(async () => {
      const result = await toggleFlag(data.id);
      if (result.ok) {
        toast.success(result.data.flagged ? "Flagged as priority" : "Priority flag removed");
      } else {
        toast.error(result.error);
      }
    });
  }

  function onUpdateStage() {
    if (!data.primary) return;
    const applicationId = data.primary.applicationId;
    startTransition(async () => {
      const result = await updateApplicationStage({ application_id: applicationId, stage });
      if (result.ok) toast.success(`Moved to ${result.data.stageLabel}`);
      else toast.error(result.error);
    });
  }

  function onAddTag() {
    const tag = tagInput.trim();
    if (!tag) return;
    startTransition(async () => {
      const result = await addTag(data.id, tag);
      if (result.ok) {
        toast.success(`Tagged with "${tag}"`);
        setTagInput("");
        setTagOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRemoveTag(tag: string) {
    startTransition(async () => {
      const result = await removeTag(data.id, tag);
      if (result.ok) toast.success(`Removed tag "${tag}"`);
      else toast.error(result.error);
    });
  }

  function onArchive() {
    setConfirmArchive(false);
    startTransition(async () => {
      const result = await setArchived(data.id, true);
      if (result.ok) {
        toast.success("Candidate archived — data is kept");
        router.push("/candidates");
      } else {
        toast.error(result.error);
      }
    });
  }

  function onRestore() {
    startTransition(async () => {
      const result = await setArchived(data.id, false);
      if (result.ok) toast.success("Candidate restored");
      else toast.error(result.error);
    });
  }

  return (
    <div className="space-y-3">
      {data.archived ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-warning/40 bg-warning-soft px-4 py-2.5">
          <p className="text-[13px] font-medium text-warning-ink">
            This candidate is archived — hidden from active lists. The record is kept.
          </p>
          <Button variant="ghost" size="sm" onClick={onRestore} loading={pending}>
            Restore candidate
          </Button>
        </div>
      ) : null}

      <Card>
        <CardBody>
          <div className="flex flex-wrap items-start justify-between gap-5">
            {/* Identity */}
            <div className="flex min-w-0 gap-4">
              <div
                aria-hidden="true"
                className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-sidebar text-lg font-extrabold text-white"
              >
                {initials(data.name)}
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[19px] font-bold text-slate-900">{data.name}</h2>
                  <button
                    type="button"
                    onClick={onToggleFlag}
                    aria-pressed={data.flagged}
                    aria-label={data.flagged ? "Remove priority flag" : "Flag as priority"}
                    title={data.flagged ? "Remove priority flag" : "Flag as priority"}
                    className={cn(
                      "rounded text-lg leading-none outline-none transition-transform hover:scale-110 focus-visible:ring-2 focus-visible:ring-primary-soft",
                      data.flagged ? "" : "opacity-30 grayscale hover:opacity-60",
                    )}
                  >
                    ⭐
                  </button>
                  {data.primary?.restrictiveVisa && data.primary.visaLabel ? (
                    <Badge variant="visa" title="Restrictive work-authorization requirement on the applied role">
                      {data.primary.visaLabel}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-0.5 text-[12.5px] text-slate-500">
                  {data.email} · {data.phone || "no phone"} · {data.location || "location unknown"} · via{" "}
                  {data.source}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  {data.tags.map((tag) => (
                    <Badge key={tag} variant="info">
                      {tag}
                      <button
                        type="button"
                        onClick={() => onRemoveTag(tag)}
                        aria-label={`Remove tag ${tag}`}
                        className="ml-0.5 rounded font-bold outline-none hover:text-danger-strong focus-visible:ring-2 focus-visible:ring-primary-soft"
                      >
                        ×
                      </button>
                    </Badge>
                  ))}
                  {tagOpen ? (
                    <span className="inline-flex items-center gap-1">
                      <Input
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            onAddTag();
                          }
                          if (e.key === "Escape") setTagOpen(false);
                        }}
                        placeholder="e.g. Top Tier"
                        aria-label="New tag"
                        autoFocus
                        className="h-7 w-36 px-2 py-1 text-[12px]"
                      />
                      <Button size="sm" onClick={onAddTag} loading={pending}>
                        Add
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => setTagOpen(false)}>
                        Cancel
                      </Button>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setTagOpen(true)}
                      className="rounded text-[12px] font-semibold text-primary outline-none hover:underline focus-visible:ring-2 focus-visible:ring-primary-soft"
                    >
                      + tag
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Scores + stage control */}
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {data.primary ? (
                  <ScorePill score={data.primary.score} className="px-3 py-1 text-[15px]" />
                ) : null}
                {data.interviewAvg !== null ? (
                  <span
                    title="Weighted interview average across all scorecards"
                    className="inline-flex min-w-11 items-center justify-center rounded-full bg-primary-soft px-3 py-1 text-[15px] font-extrabold tabular-nums text-primary-ink"
                  >
                    {data.interviewAvg}★<span className="sr-only">interview average out of 5</span>
                  </span>
                ) : null}
              </div>
              {data.primary !== null || data.interviewAvg !== null ? (
                <p className="text-[11.5px] text-slate-400">
                  {data.primary ? "match score" : ""}
                  {data.primary && data.interviewAvg !== null ? " · " : ""}
                  {data.interviewAvg !== null ? "interview avg" : ""}
                </p>
              ) : null}
              {data.primary ? (
                <div className="flex items-center gap-2">
                  <Select
                    value={stage}
                    onChange={(e) => setStage(e.target.value as Stage)}
                    aria-label="Pipeline stage"
                    className="w-36 py-1.5 text-[13px]"
                  >
                    {STAGES.map((s) => (
                      <option key={s} value={s}>
                        {STAGE_LABELS[s]}
                      </option>
                    ))}
                  </Select>
                  <Button size="sm" onClick={onUpdateStage} loading={pending} disabled={stage === data.primary.stage}>
                    Update stage
                  </Button>
                </div>
              ) : null}
              {!data.archived ? (
                <Button variant="ghost" size="sm" onClick={() => setConfirmArchive(true)}>
                  Archive candidate
                </Button>
              ) : null}
            </div>
          </div>

          {/* Fact grid */}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 lg:grid-cols-4">
            <div>
              <p className="micro-label text-slate-400">Applied role</p>
              {data.primary ? (
                <>
                  <p className="text-[13px] font-semibold text-slate-800">{data.primary.jobTitle}</p>
                  <p className="text-[12px] text-slate-400">
                    {data.primary.clientName}
                    {data.extraApplications > 0 ? ` · +${data.extraApplications} more` : ""}
                  </p>
                </>
              ) : (
                <p className="text-[13px] text-slate-400">No applications yet</p>
              )}
            </div>
            <div>
              <p className="micro-label text-slate-400">Stage</p>
              {data.primary ? (
                <p className="flex items-center gap-2">
                  <StageBadge stage={data.primary.stage} />
                  <span
                    className={cn(
                      "text-[12px] tabular-nums",
                      data.primary.isStalled ? "font-bold text-warning-ink" : "text-slate-400",
                    )}
                  >
                    {data.primary.daysInStage}d{data.primary.isStalled ? " ⚠ stalled" : ""}
                  </span>
                </p>
              ) : (
                <p className="text-[13px] text-slate-400">—</p>
              )}
            </div>
            <div>
              <p className="micro-label text-slate-400">Expected salary</p>
              <p className="text-[13px] font-semibold text-slate-800">{data.expectedSalary || "—"}</p>
            </div>
            <div>
              <p className="micro-label text-slate-400">Notice period</p>
              <p className="text-[13px] font-semibold text-slate-800">{data.noticePeriod || "—"}</p>
            </div>
          </div>
        </CardBody>
      </Card>

      <Modal
        open={confirmArchive}
        onClose={() => setConfirmArchive(false)}
        title="Archive this candidate?"
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmArchive(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={onArchive} loading={pending}>
              Archive candidate
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] text-slate-600">
          {data.name} will be hidden from the candidate list, pipeline and reports. Nothing is
          deleted — you can restore the record from this page at any time.
        </p>
      </Modal>
    </div>
  );
}
