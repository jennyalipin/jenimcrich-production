"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  Button,
  FieldError,
  Input,
  Label,
  Modal,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { SOURCES } from "@/lib/data/types";
import { createCandidate } from "../actions";
import type { JobOption } from "../_lib/view-types";

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

/** "+ Add candidate" button with its modal form (zod-validated server action). */
export function AddCandidateButton({ jobs }: { jobs: JobOption[] }) {
  const router = useRouter();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<FormValues>(() => emptyForm(jobs));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, startTransition] = useTransition();

  function set<K extends keyof FormValues>(key: K, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function openModal() {
    setValues(emptyForm(jobs));
    setErrors({});
    setOpen(true);
  }

  function submit() {
    setErrors({});
    startTransition(async () => {
      const result = await createCandidate(values);
      if (result.ok) {
        toast.success("Candidate added");
        if (result.data.duplicateEmail) {
          toast.info("Heads up — another active candidate already uses this email.", { duration: 7000 });
        }
        setOpen(false);
        router.push(`/candidates/${result.data.id}`);
      } else {
        setErrors(result.fieldErrors ?? {});
        toast.error(result.error);
      }
    });
  }

  const inputProps = (key: keyof FormValues) => ({
    id: `nc-${key}`,
    value: values[key],
    invalid: Boolean(errors[key]),
    "aria-describedby": errors[key] ? `nc-${key}-error` : undefined,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
    ) => set(key, e.target.value),
  });

  return (
    <>
      <Button size="sm" onClick={openModal}>
        + Add candidate
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add candidate"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" form="add-candidate-form" loading={pending}>
              Add candidate
            </Button>
          </>
        }
      >
        <form
          id="add-candidate-form"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          noValidate
        >
          <div className="grid grid-cols-1 gap-x-4 gap-y-3 sm:grid-cols-2">
            <Field label="Full name" required htmlFor="nc-full_name" error={errors.full_name}>
              <Input {...inputProps("full_name")} autoFocus />
            </Field>
            <Field label="Email" required htmlFor="nc-email" error={errors.email}>
              <Input type="email" {...inputProps("email")} />
            </Field>
            <Field label="Phone" htmlFor="nc-phone" error={errors.phone}>
              <Input {...inputProps("phone")} placeholder="+63 917 000 0000" />
            </Field>
            <Field label="Location" htmlFor="nc-location" error={errors.location}>
              <Input {...inputProps("location")} placeholder="Cebu, PH" />
            </Field>
            <Field label="Applying for" required htmlFor="nc-job_id" error={errors.job_id}>
              <Select {...inputProps("job_id")}>
                {jobs.map((job) => (
                  <option key={job.id} value={job.id}>
                    {job.title} — {job.clientName}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Source" htmlFor="nc-source" error={errors.source}>
              <Select {...inputProps("source")}>
                {SOURCES.map((source) => (
                  <option key={source}>{source}</option>
                ))}
              </Select>
            </Field>
            <Field label="Years of experience" htmlFor="nc-years_exp" error={errors.years_exp}>
              <Input type="number" min={0} max={60} {...inputProps("years_exp")} />
            </Field>
            <Field label="Expected salary" htmlFor="nc-expected_salary" error={errors.expected_salary}>
              <Input {...inputProps("expected_salary")} placeholder="₱90,000/mo" />
            </Field>
            <Field label="Notice period" htmlFor="nc-notice_period" error={errors.notice_period}>
              <Input {...inputProps("notice_period")} placeholder="30 days" />
            </Field>
          </div>
          <div className="mt-3 space-y-3">
            <Field
              label='Skills (comma separated, "Skill:years")'
              htmlFor="nc-skills_raw"
              error={errors.skills_raw}
            >
              <Input {...inputProps("skills_raw")} placeholder="Plant Operations:8, Safety Compliance:5" />
            </Field>
            <Field label="Summary" htmlFor="nc-summary" error={errors.summary}>
              <Textarea rows={3} {...inputProps("summary")} placeholder="Background, highlights, fit notes…" />
            </Field>
          </div>
        </form>
      </Modal>
    </>
  );
}
