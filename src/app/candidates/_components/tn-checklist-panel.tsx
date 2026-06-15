"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Icon,
  Label,
  Textarea,
  cn,
  useToast,
  type BadgeVariant,
} from "@/components/ui";
import { VISA_LABELS, type TnChecklistStatus } from "@/lib/data/types";
import {
  clearLegalReviewAction,
  runTnEligibilityCheckAction,
} from "./tn-compliance-actions";

const CONFIDENCE_LABELS: Record<"exact" | "keyword" | "none", string> = {
  exact: "Exact occupation match",
  keyword: "Keyword match",
  none: "No professional occupation matched",
};

function eligibilityBadge(status: TnChecklistStatus): { variant: BadgeVariant; text: string } {
  if (status.eligible === null) return { variant: "info", text: "Not screened" };
  if (status.eligible) return { variant: "success", text: "May qualify" };
  return { variant: "danger", text: "Does not qualify" };
}

export function TnChecklistPanel({
  status,
  candidateId,
  isAdmin,
}: {
  status: TnChecklistStatus;
  candidateId: string;
  isAdmin: boolean;
}) {
  const toast = useToast();
  const [running, startRun] = useTransition();
  const [clearing, startClear] = useTransition();
  const [notes, setNotes] = useState("");
  const [showClearForm, setShowClearForm] = useState(false);

  const badge = eligibilityBadge(status);
  const pendingReview = status.legalReviewRequired;
  const clearedAt = status.legalReviewClearedAt;

  function runCheck() {
    startRun(async () => {
      const res = await runTnEligibilityCheckAction(status.applicationId, candidateId);
      if (res.ok) toast.success("TN eligibility screen updated.");
      else toast.error(res.error ?? "Could not run the eligibility check.");
    });
  }

  function clearReview() {
    startClear(async () => {
      const res = await clearLegalReviewAction(status.applicationId, candidateId, notes);
      if (res.ok) {
        toast.success("Attorney sign-off recorded.");
        setShowClearForm(false);
        setNotes("");
      } else {
        toast.error(res.error ?? "Could not clear the legal review.");
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <span className="inline-flex items-center gap-1.5">
            <Icon name="document" size={16} className="text-slate-500" />
            TN compliance — {status.jobTitle}
          </span>
        </CardTitle>
        <Badge variant="visa" title={VISA_LABELS[status.visa]}>
          {VISA_LABELS[status.visa]}
        </Badge>
      </CardHeader>

      <CardBody className="space-y-4">
        {/* Non-dismissible attorney-review notice while sign-off is pending. */}
        {pendingReview ? (
          <div
            role="note"
            className="flex items-start gap-2 rounded-control border border-warning-soft bg-warning-soft/40 px-3 py-2.5"
          >
            <Icon name="stalled" size={16} className="mt-0.5 shrink-0 text-warning-ink" />
            <p className="text-[12.5px] leading-relaxed text-warning-ink">
              TN eligibility has not been reviewed by a licensed immigration attorney — do not
              present this to clients or candidates.
            </p>
          </div>
        ) : clearedAt ? (
          <div className="flex items-start gap-2 rounded-control border border-primary-soft bg-primary-faint px-3 py-2.5">
            <Icon name="check" size={16} className="mt-0.5 shrink-0 text-primary" />
            <div className="text-[12.5px] leading-relaxed text-slate-600">
              <p className="font-semibold text-slate-700">Reviewed by a licensed immigration attorney.</p>
              {status.legalReviewNotes ? <p className="mt-0.5">{status.legalReviewNotes}</p> : null}
            </div>
          </div>
        ) : null}

        {/* Eligibility screen result. */}
        <section className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="micro-label text-slate-500">Occupation eligibility (USMCA)</h4>
            <Badge variant={badge.variant}>{badge.text}</Badge>
          </div>
          <dl className="grid grid-cols-1 gap-x-4 gap-y-1.5 text-[12.5px] sm:grid-cols-2">
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-1 sm:border-0 sm:pb-0">
              <dt className="text-slate-500">Matched occupation</dt>
              <dd className="text-right font-medium text-slate-700">
                {status.matchedOccupation ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-2 border-b border-slate-100 pb-1 sm:border-0 sm:pb-0">
              <dt className="text-slate-500">Match basis</dt>
              <dd className="text-right font-medium text-slate-700">
                {status.confidence ? CONFIDENCE_LABELS[status.confidence] : "—"}
              </dd>
            </div>
          </dl>
          <Button variant="secondary" size="sm" onClick={runCheck} disabled={running}>
            {running ? "Screening…" : status.eligible === null ? "Run eligibility check" : "Re-run eligibility check"}
          </Button>
        </section>

        {/* Required-document checklist. */}
        <section className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <h4 className="micro-label text-slate-500">Required TN documents</h4>
            <span className="text-[11.5px] text-slate-500">
              {status.docs.filter((d) => d.present).length}/{status.docs.length} on file
            </span>
          </div>
          <ul className="space-y-1.5">
            {status.docs.map((doc) => (
              <li key={doc.category} className="flex items-start gap-2">
                <Icon
                  name={doc.present ? "check" : "close"}
                  size={15}
                  className={cn("mt-0.5 shrink-0", doc.present ? "text-primary" : "text-slate-300")}
                />
                <span className="min-w-0">
                  <span
                    className={cn(
                      "text-[13px] font-medium",
                      doc.present ? "text-slate-700" : "text-slate-500",
                    )}
                  >
                    {doc.label}
                  </span>
                  <span className="block text-[11.5px] text-slate-500">{doc.hint}</span>
                </span>
              </li>
            ))}
          </ul>
          {!status.allDocsPresent ? (
            <p className="text-[11.5px] text-slate-500">
              Upload missing items in the Documents tab using the matching document type.
            </p>
          ) : null}
        </section>

        {/* Admin-only attorney sign-off. */}
        {isAdmin && pendingReview ? (
          <section className="border-t border-slate-100 pt-3">
            {showClearForm ? (
              <div className="space-y-2">
                <Label htmlFor="tn-review-notes" className="text-[12px] text-slate-500">
                  Attorney sign-off note (optional)
                </Label>
                <Textarea
                  id="tn-review-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="e.g. Reviewed 2026-06-16 by counsel; mining-engineer duties confirmed."
                  className="text-[13px]"
                />
                <div className="flex items-center gap-2">
                  <Button size="sm" onClick={clearReview} disabled={clearing}>
                    {clearing ? "Recording…" : "Record attorney sign-off"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowClearForm(false)}
                    disabled={clearing}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => setShowClearForm(true)}>
                Record attorney sign-off…
              </Button>
            )}
          </section>
        ) : null}
      </CardBody>
    </Card>
  );
}
