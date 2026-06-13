"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
} from "@/components/ui";
import { VISA_LABELS, VISA_TYPES, type VisaType } from "@/lib/data/types";
import { parseJD } from "@/lib/jd-parser";
import { createJobAction } from "./actions";

type Weight = 1 | 2 | 3;

interface SkillRow {
  skill: string;
  weight: Weight;
}

interface FormState {
  jd_text: string;
  title: string;
  client_name: string;
  location: string;
  salary_range: string;
  min_years: string;
  status: "open" | "on_hold";
  visa: VisaType;
  visa_notes: string;
  skills: SkillRow[];
  requirements: string;
  description: string;
}

const WEIGHT_LABELS: Record<Weight, string> = {
  1: "1 · Nice-to-have",
  2: "2 · Important",
  3: "3 · Must-have",
};

function emptyForm(): FormState {
  return {
    jd_text: "",
    title: "",
    client_name: "",
    location: "",
    salary_range: "",
    min_years: "5",
    status: "open",
    visa: "UNSPECIFIED",
    visa_notes: "",
    skills: [{ skill: "", weight: 2 }],
    requirements: "",
    description: "",
  };
}

export interface NewJobButtonProps {
  /** Existing client names — offered as autocomplete suggestions. */
  clientNames: string[];
  /** Live skill dictionary (jobs + candidates) for the JD parser. */
  skillDictionary: string[];
}

/**
 * "+ New job" → modal with the prototype's JD-paste auto-fill flow:
 * paste text, auto-fill blanks via the pure parser, review, save.
 */
export function NewJobButton({ clientNames, skillDictionary }: NewJobButtonProps) {
  const router = useRouter();
  const formId = useId();
  const clientsListId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [autofillNote, setAutofillNote] = useState<string | null>(null);
  const [createdTitle, setCreatedTitle] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openModal() {
    setForm(emptyForm());
    setFieldErrors({});
    setFormError(null);
    setAutofillNote(null);
    setOpen(true);
  }

  /** Fill ONLY blank fields from the pasted JD, exactly like the prototype. */
  function autofill() {
    if (!form.jd_text.trim()) {
      setAutofillNote("Paste the job description text first, then click Auto-fill blanks.");
      return;
    }
    const parsed = parseJD(form.jd_text, skillDictionary);
    setForm((prev) => {
      const keep = (current: string, found: string) => (current.trim() ? current : found || current);
      return {
        ...prev,
        title: keep(prev.title, parsed.title),
        client_name: keep(prev.client_name, parsed.client),
        location: keep(prev.location, parsed.location),
        salary_range: keep(prev.salary_range, parsed.salary),
        min_years: parsed.minYears !== null ? String(parsed.minYears) : prev.min_years,
        visa: parsed.visa !== "UNSPECIFIED" ? parsed.visa : prev.visa,
        visa_notes: keep(prev.visa_notes, parsed.visaNotes),
        requirements: keep(prev.requirements, parsed.requirements.join("\n")),
        description: keep(prev.description, parsed.description),
        skills:
          parsed.skills.length > 0 && prev.skills.every((s) => !s.skill.trim())
            ? parsed.skills.map((s) => ({ skill: s.skill, weight: s.weight }))
            : prev.skills,
      };
    });
    setAutofillNote("Blanks auto-filled from the JD — review and adjust before saving.");
  }

  function updateSkill(index: number, patch: Partial<SkillRow>) {
    setForm((prev) => ({
      ...prev,
      skills: prev.skills.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    }));
  }

  function removeSkill(index: number) {
    setForm((prev) => ({
      ...prev,
      skills:
        prev.skills.length > 1
          ? prev.skills.filter((_, i) => i !== index)
          : [{ skill: "", weight: 2 }],
    }));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    const payload = {
      title: form.title,
      client_name: form.client_name,
      location: form.location,
      salary_range: form.salary_range,
      min_years: form.min_years.trim() === "" ? 0 : Number(form.min_years),
      status: form.status,
      visa: form.visa,
      visa_notes: form.visa_notes,
      skills: form.skills
        .map((s) => ({ skill: s.skill.trim(), weight: s.weight }))
        .filter((s) => s.skill.length > 0),
      requirements: form.requirements,
      description: form.description,
      jd_text: form.jd_text,
    };
    startTransition(async () => {
      const result = await createJobAction(payload);
      if (result.ok) {
        setCreatedTitle(payload.title.trim());
        setOpen(false);
        router.refresh();
      } else {
        setFieldErrors(result.fieldErrors ?? {});
        setFormError(result.formError ?? null);
      }
    });
  }

  return (
    <div className="flex items-center gap-3">
      {createdTitle ? (
        <span className="text-xs font-semibold text-primary-ink" role="status">
          ✓ “{createdTitle}” created
        </span>
      ) : null}
      <Button onClick={openModal}>+ New job</Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New job listing"
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form={formId} loading={isPending}>
              Create listing
            </Button>
          </>
        }
      >
        <form id={formId} onSubmit={handleSubmit} noValidate>
          {formError ? (
            <div
              role="alert"
              className="mb-4 rounded-control border border-danger-soft bg-danger-soft/50 px-3 py-2 text-[13px] font-medium text-danger-ink"
            >
              {formError}
            </div>
          ) : null}

          {/* JD auto-fill */}
          <div className="mb-5 rounded-card border border-primary-soft bg-primary-faint p-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-[13px] font-semibold text-primary-ink">
                ⚡ Auto-fill from a job description
              </p>
              <Button size="sm" onClick={autofill}>
                Auto-fill blanks
              </Button>
            </div>
            <Textarea
              rows={5}
              value={form.jd_text}
              onChange={(e) => set("jd_text", e.target.value)}
              placeholder="Paste the full job description text here, then click Auto-fill blanks. Title, location, salary, years, skills, requirements and visa terms are extracted for you."
              aria-label="Job description text"
              className="mt-2.5 bg-surface"
            />
            <p className="mt-2 text-xs text-slate-500">
              {autofillNote ??
                "Best results with pasted text. For PDF/Word JDs: open the file, copy the text, paste above."}
            </p>
          </div>

          {/* Core fields */}
          <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${formId}-title`} requiredMark>
                Title
              </Label>
              <Input
                id={`${formId}-title`}
                value={form.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Plant Manager – Cement"
                invalid={Boolean(fieldErrors.title)}
                aria-describedby={fieldErrors.title ? `${formId}-title-err` : undefined}
              />
              <FieldError id={`${formId}-title-err`}>{fieldErrors.title}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${formId}-client`} requiredMark>
                Client
              </Label>
              <Input
                id={`${formId}-client`}
                value={form.client_name}
                onChange={(e) => set("client_name", e.target.value)}
                placeholder="Helix Cement Corp"
                list={clientsListId}
                invalid={Boolean(fieldErrors.client_name)}
                aria-describedby={fieldErrors.client_name ? `${formId}-client-err` : undefined}
              />
              <datalist id={clientsListId}>
                {clientNames.map((name) => (
                  <option key={name} value={name} />
                ))}
              </datalist>
              <FieldError id={`${formId}-client-err`}>{fieldErrors.client_name}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${formId}-location`}>Location</Label>
              <Input
                id={`${formId}-location`}
                value={form.location}
                onChange={(e) => set("location", e.target.value)}
                placeholder="Cebu, PH"
              />
            </div>
            <div>
              <Label htmlFor={`${formId}-salary`}>Salary range</Label>
              <Input
                id={`${formId}-salary`}
                value={form.salary_range}
                onChange={(e) => set("salary_range", e.target.value)}
                placeholder="$100k–140k/yr"
              />
            </div>
            <div>
              <Label htmlFor={`${formId}-years`}>Min years experience</Label>
              <Input
                id={`${formId}-years`}
                type="number"
                min={0}
                max={40}
                value={form.min_years}
                onChange={(e) => set("min_years", e.target.value)}
                invalid={Boolean(fieldErrors.min_years)}
                aria-describedby={fieldErrors.min_years ? `${formId}-years-err` : undefined}
              />
              <FieldError id={`${formId}-years-err`}>{fieldErrors.min_years}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${formId}-status`}>Status</Label>
              <Select
                id={`${formId}-status`}
                value={form.status}
                onChange={(e) => set("status", e.target.value as "open" | "on_hold")}
              >
                <option value="open">Open</option>
                <option value="on_hold">On Hold</option>
              </Select>
            </div>
            <div>
              <Label htmlFor={`${formId}-visa`}>Work authorization / visa</Label>
              <Select
                id={`${formId}-visa`}
                value={form.visa}
                onChange={(e) => set("visa", e.target.value as VisaType)}
              >
                {VISA_TYPES.map((visa) => (
                  <option key={visa} value={visa}>
                    {VISA_LABELS[visa]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${formId}-visa-notes`}>Visa notes (optional)</Label>
              <Input
                id={`${formId}-visa-notes`}
                value={form.visa_notes}
                onChange={(e) => set("visa_notes", e.target.value)}
                placeholder="e.g. TN renewable yearly; client won't sponsor H-1B"
              />
            </div>
          </div>

          {/* Weighted skills editor */}
          <div className="mt-5">
            <Label requiredMark>Key skills &amp; weights</Label>
            <div className="space-y-2">
              {form.skills.map((row, index) => (
                <div key={index} className="flex items-center gap-2">
                  <Input
                    value={row.skill}
                    onChange={(e) => updateSkill(index, { skill: e.target.value })}
                    placeholder="e.g. Kiln Management"
                    aria-label={`Skill ${index + 1} name`}
                    className="flex-1"
                  />
                  <Select
                    value={row.weight}
                    onChange={(e) => updateSkill(index, { weight: Number(e.target.value) as Weight })}
                    aria-label={`Skill ${index + 1} weight`}
                    className="w-40 shrink-0"
                  >
                    {([1, 2, 3] as const).map((w) => (
                      <option key={w} value={w}>
                        {WEIGHT_LABELS[w]}
                      </option>
                    ))}
                  </Select>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeSkill(index)}
                    aria-label={`Remove skill ${index + 1}`}
                    className="shrink-0 px-2"
                  >
                    ✕
                  </Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setForm((prev) => ({ ...prev, skills: [...prev.skills, { skill: "", weight: 2 }] }))}
              >
                + Add skill
              </Button>
              <p className="text-xs text-slate-500">Weight 3 = must-have; it drives the match score.</p>
            </div>
            <FieldError>{fieldErrors.skills}</FieldError>
          </div>

          {/* Requirements & description */}
          <div className="mt-5">
            <Label htmlFor={`${formId}-reqs`}>Requirements (one per line)</Label>
            <Textarea
              id={`${formId}-reqs`}
              rows={3}
              value={form.requirements}
              onChange={(e) => set("requirements", e.target.value)}
              placeholder={"10+ yrs cement plant operations\nKiln & pyro-processing expertise"}
            />
          </div>
          <div className="mt-3.5">
            <Label htmlFor={`${formId}-desc`}>Description</Label>
            <Textarea
              id={`${formId}-desc`}
              rows={2}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="One-paragraph summary of the role"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
