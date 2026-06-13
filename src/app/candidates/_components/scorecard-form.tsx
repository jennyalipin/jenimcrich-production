"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  FieldError,
  Icon,
  Label,
  Select,
  Textarea,
  cn,
  useToast,
} from "@/components/ui";
import {
  RECOMMENDATIONS,
  RECOMMENDATION_LABELS,
  SCORECARD_COMPETENCIES,
  type Recommendation,
} from "@/lib/data/types";
import { saveScorecard } from "../actions";
import type { ApplicationOption, InterviewerOption } from "../_lib/view-types";

function StarRating({
  label,
  weight,
  value,
  onChange,
}: {
  label: string;
  weight: number;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0">
      <span className="text-[13px] text-slate-600">
        {label} <span className="text-[11px] text-slate-500">(w{weight})</span>
      </span>
      <span
        role="radiogroup"
        aria-label={`${label} rating`}
        className="inline-flex items-center gap-0.5"
      >
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} of 5`}
            onClick={() => onChange(value === n ? 0 : n)}
            className={cn(
              "rounded leading-none outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary-soft",
              n <= value ? "text-amber-400" : "text-slate-200 hover:text-amber-200",
            )}
          >
            <Icon name="star" size={17} fill={n <= value} />
          </button>
        ))}
      </span>
    </div>
  );
}

/** New interview scorecard: per-competency stars + recommendation + summary. */
export function ScorecardForm({
  applications,
  interviewers,
}: {
  applications: ApplicationOption[];
  interviewers: InterviewerOption[];
}) {
  const toast = useToast();
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [interviewerId, setInterviewerId] = useState(interviewers[0]?.id ?? "");
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [recommendation, setRecommendation] = useState<Recommendation>("hire");
  const [summary, setSummary] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function setRating(key: string, n: number) {
    setRatings((prev) => {
      const next = { ...prev };
      if (n === 0) delete next[key];
      else next[key] = n;
      return next;
    });
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await saveScorecard({
        application_id: applicationId,
        interviewer_id: interviewerId,
        ratings,
        summary,
        recommendation,
      });
      if (result.ok) {
        toast.success("Scorecard saved");
        setRatings({});
        setSummary("");
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  if (applications.length === 0) {
    return (
      <Card className="self-start">
        <CardBody>
          <p className="text-[13px] text-slate-500">
            Scorecards attach to an application — add this candidate to a role first.
          </p>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="self-start">
      <CardHeader>
        <CardTitle>New interview scorecard</CardTitle>
      </CardHeader>
      <CardBody>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
          className="space-y-3"
        >
          {applications.length > 1 ? (
            <div>
              <Label htmlFor="sc-application">Application</Label>
              <Select
                id="sc-application"
                value={applicationId}
                onChange={(e) => setApplicationId(e.target.value)}
              >
                {applications.map((app) => (
                  <option key={app.id} value={app.id}>
                    {app.label}
                  </option>
                ))}
              </Select>
            </div>
          ) : null}
          <div>
            <Label htmlFor="sc-interviewer">Interviewer</Label>
            <Select
              id="sc-interviewer"
              value={interviewerId}
              onChange={(e) => setInterviewerId(e.target.value)}
            >
              {interviewers.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.name}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <p className="micro-label mb-1 text-slate-600">Competencies</p>
            {SCORECARD_COMPETENCIES.map((cat) => (
              <StarRating
                key={cat.key}
                label={cat.key}
                weight={cat.weight}
                value={ratings[cat.key] ?? 0}
                onChange={(n) => setRating(cat.key, n)}
              />
            ))}
            <FieldError id="sc-ratings-error">{errors.ratings}</FieldError>
          </div>

          <div>
            <Label htmlFor="sc-recommendation">Recommendation</Label>
            <Select
              id="sc-recommendation"
              value={recommendation}
              onChange={(e) => setRecommendation(e.target.value as Recommendation)}
            >
              {RECOMMENDATIONS.map((rec) => (
                <option key={rec} value={rec}>
                  {RECOMMENDATION_LABELS[rec]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="sc-summary" requiredMark>
              Summary
            </Label>
            <Textarea
              id="sc-summary"
              rows={3}
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              invalid={Boolean(errors.summary)}
              aria-describedby={errors.summary ? "sc-summary-error" : undefined}
              placeholder="Strengths, concerns, overall read…"
            />
            <FieldError id="sc-summary-error">{errors.summary}</FieldError>
          </div>
          <Button type="submit" loading={pending}>
            Submit scorecard
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}
