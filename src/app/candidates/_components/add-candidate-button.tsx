"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ReactNode } from "react";
import {
  Button,
  FieldError,
  Icon,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
  cn,
  useToast,
} from "@/components/ui";
import { SOURCES } from "@/lib/data/types";
import { createCandidate } from "../actions";
import { analyzeResumeAction } from "@/app/matchmaker/ai-actions";
import type { JobOption } from "../_lib/view-types";

/** NEXT_PUBLIC_* is inlined at build time, so this is safe in a client component. */
const AI_ON = process.env.NEXT_PUBLIC_AI_ENABLED === "true";

interface FormValues {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  job_id: string;
  source: string;
  years_exp: string;
  expected_salary: string;
  notice_period: string;
  skills_raw: string;
  summary: string;
}

type FieldKey = keyof FormValues;

function emptyForm(jobs: JobOption[]): FormValues {
  return {
    full_name: "",
    email: "",
    phone: "",
    location: "",
    job_id: jobs[0]?.id ?? "",
    source: SOURCES[0],
    years_exp: "3",
    expected_salary: "",
    notice_period: "",
    skills_raw: "",
    summary: "",
  };
}

interface StepDef {
  id: string;
  title: string;
  hint: string;
  fields: FieldKey[];
  required: FieldKey[];
}

const STEPS: StepDef[] = [
  {
    id: "candidate",
    title: "Candidate",
    hint: "Who they are.",
    fields: ["full_name", "email", "phone", "location"],
    required: ["full_name", "email"],
  },
  {
    id: "application",
    title: "Application",
    hint: "What they're applying for.",
    fields: ["job_id", "source", "years_exp", "expected_salary", "notice_period"],
    required: ["job_id"],
  },
  {
    id: "profile",
    title: "Skills & summary",
    hint: "How they fit.",
    fields: ["skills_raw", "summary"],
    required: [],
  },
];

const LABELS: Record<FieldKey, string> = {
  full_name: "Full name",
  email: "Email",
  phone: "Phone",
  location: "Location",
  job_id: "Applying for",
  source: "Source",
  years_exp: "Years of experience",
  expected_salary: "Expected salary",
  notice_period: "Notice period",
  skills_raw: 'Skills (comma separated, "Skill:years")',
  summary: "Summary",
};

const stepOfField = (key: FieldKey): number =>
  STEPS.findIndex((s) => s.fields.includes(key));

function Field({
  label,
  required,
  error,
  htmlFor,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={htmlFor} requiredMark={required}>
        {label}
      </Label>
      {children}
      <FieldError id={`${htmlFor}-error`}>{error}</FieldError>
    </div>
  );
}

/** "+ Add candidate" — a 3-step intake wizard backed by the zod server action. */
export function AddCandidateButton({
  jobs,
  skillDictionary = [],
}: {
  jobs: JobOption[];
  /** Live skill vocabulary for AI auto-fill (flag-gated; empty when AI is off). */
  skillDictionary?: string[];
}) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [values, setValues] = useState<FormValues>(() => emptyForm(jobs));
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});
  const [pending, startTransition] = useTransition();

  // AI "auto-fill from resume" state (last step only, flag-gated).
  const [resumeText, setResumeText] = useState("");
  const [aiFilled, setAiFilled] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPending, startAiTransition] = useTransition();

  function autofillFromResume() {
    const text = resumeText.trim();
    if (text.length < 40) {
      setAiError("Paste at least a few lines of resume text so there is something to analyze.");
      return;
    }
    setAiError(null);
    startAiTransition(async () => {
      const parsed = await analyzeResumeAction({ text, skillDictionary });
      setValues((prev) => ({
        ...prev,
        // Only fill the name when the user hasn't typed one.
        full_name: prev.full_name.trim() || (parsed.name === "Pasted candidate" ? "" : parsed.name),
        years_exp: parsed.yearsExp > 0 ? String(parsed.yearsExp) : prev.years_exp,
        skills_raw: parsed.skills.map((s) => `${s.skill}:${s.years}`).join(", ") || prev.skills_raw,
        summary: parsed.summary || prev.summary,
      }));
      setAiFilled(true);
    });
  }

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function set(key: FieldKey, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: undefined }));
  }

  function openModal() {
    setValues(emptyForm(jobs));
    setErrors({});
    setStep(0);
    setResumeText("");
    setAiFilled(false);
    setAiError(null);
    setOpen(true);
  }

  /** Light client check so a step can't advance with its required fields empty. */
  function stepValid(index: number): boolean {
    return STEPS[index].required.every((k) => values[k].trim() !== "");
  }

  function next() {
    if (!stepValid(step)) {
      const missing: Partial<Record<FieldKey, string>> = {};
      for (const k of current.required) {
        if (!values[k].trim()) missing[k] = "This field is required.";
      }
      setErrors((prev) => ({ ...prev, ...missing }));
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await createCandidate(values);
      if (result.ok) {
        toast.success("Candidate added");
        if (result.data.duplicateEmail) {
          toast.info("Heads up — another active candidate already uses this email.", {
            duration: 7000,
          });
        }
        setOpen(false);
        router.push(`/candidates/${result.data.id}`);
      } else {
        const fieldErrors = (result.fieldErrors ?? {}) as Partial<Record<FieldKey, string>>;
        setErrors(fieldErrors);
        // Jump to the earliest step that has an error.
        const firstBad = Object.keys(fieldErrors)[0] as FieldKey | undefined;
        if (firstBad) {
          const target = stepOfField(firstBad);
          if (target >= 0) setStep(target);
        }
        toast.error(result.error);
      }
    });
  }

  const fieldProps = (key: FieldKey) => ({
    id: `nc-${key}`,
    value: values[key],
    invalid: Boolean(errors[key]),
    "aria-describedby": errors[key] ? `nc-${key}-error` : undefined,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => set(key, e.target.value),
  });

  function renderControl(key: FieldKey) {
    switch (key) {
      case "job_id":
        return (
          <Select {...fieldProps("job_id")}>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.title} — {job.clientName}
              </option>
            ))}
          </Select>
        );
      case "source":
        return (
          <Select {...fieldProps("source")}>
            {SOURCES.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </Select>
        );
      case "years_exp":
        return <Input type="number" min={0} max={60} {...fieldProps("years_exp")} />;
      case "email":
        return <Input type="email" {...fieldProps("email")} />;
      case "summary":
        return (
          <Textarea
            rows={4}
            {...fieldProps("summary")}
            placeholder="Background, highlights, fit notes…"
          />
        );
      case "skills_raw":
        return (
          <Input {...fieldProps("skills_raw")} placeholder="Plant Operations:8, Safety Compliance:5" />
        );
      case "phone":
        return <Input {...fieldProps("phone")} placeholder="+63 917 000 0000" />;
      case "location":
        return <Input {...fieldProps("location")} placeholder="Cebu, PH" />;
      case "expected_salary":
        return <Input {...fieldProps("expected_salary")} placeholder="₱90,000/mo" />;
      case "notice_period":
        return <Input {...fieldProps("notice_period")} placeholder="30 days" />;
      default:
        return <Input {...fieldProps(key)} autoFocus={key === "full_name"} />;
    }
  }

  const footer = useMemo(
    () => (
      <>
        <Button
          variant="ghost"
          onClick={() => (step === 0 ? setOpen(false) : setStep((s) => s - 1))}
          disabled={pending}
        >
          {step === 0 ? "Cancel" : "Back"}
        </Button>
        {isLast ? (
          <Button onClick={submit} loading={pending}>
            Add candidate
          </Button>
        ) : (
          <Button onClick={next}>Continue</Button>
        )}
      </>
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step, isLast, pending, values],
  );

  return (
    <>
      <Button size="sm" onClick={openModal}>
        + Add candidate
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add candidate"
        footer={footer}
      >
        {/* Step indicator */}
        <ol className="mb-5 flex items-center gap-2" aria-label="Intake steps">
          {STEPS.map((s, i) => {
            const state = i < step ? "done" : i === step ? "active" : "todo";
            return (
              <li key={s.id} className="flex flex-1 items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-bold transition-colors",
                    state === "done" && "bg-primary text-white",
                    state === "active" && "bg-primary text-white",
                    state === "todo" && "bg-slate-100 text-slate-400",
                  )}
                >
                  {state === "done" ? <Icon name="check" size={13} /> : i + 1}
                </span>
                <span
                  className={cn(
                    "hidden text-[12.5px] font-semibold sm:inline",
                    state === "todo" ? "text-slate-400" : "text-slate-700",
                  )}
                >
                  {s.title}
                </span>
                {i < STEPS.length - 1 ? (
                  <span
                    className={cn(
                      "h-px flex-1 transition-colors",
                      i < step ? "bg-primary" : "bg-slate-200",
                    )}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>

        <p className="mb-3 text-[13px] text-slate-500">{current.hint}</p>

        {AI_ON && current.id === "profile" ? (
          <div className="mb-4 rounded-card border border-slate-200 bg-slate-50 p-3">
            <Label htmlFor="nc-ai-resume" className="text-[12.5px] text-slate-600">
              Auto-fill from resume
            </Label>
            <Textarea
              id="nc-ai-resume"
              rows={4}
              value={resumeText}
              onChange={(e) => {
                setResumeText(e.target.value);
                if (aiError) setAiError(null);
              }}
              placeholder="Paste the resume text — name, years of experience, skills, certifications…"
              className="mt-1"
            />
            <FieldError id="nc-ai-resume-error">{aiError ?? undefined}</FieldError>
            <div className="mt-2 flex items-center justify-between gap-3">
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={autofillFromResume}
                loading={aiPending}
              >
                Auto-fill from resume
              </Button>
              {aiFilled ? (
                <span className="text-[12px] font-medium text-emerald-700">
                  Filled by AI — review before saving
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          key={current.id}
          className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2"
        >
          {current.fields.map((key) => (
            <div key={key} className={key === "summary" || key === "skills_raw" ? "sm:col-span-2" : ""}>
              <Field
                label={LABELS[key]}
                required={current.required.includes(key)}
                htmlFor={`nc-${key}`}
                error={errors[key]}
              >
                {renderControl(key)}
              </Field>
            </div>
          ))}
        </div>
      </Modal>
    </>
  );
}
