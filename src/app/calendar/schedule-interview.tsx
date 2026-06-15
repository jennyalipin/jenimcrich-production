"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Icon, Input, Label, Modal, Select } from "@/components/ui";
import {
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  type InterviewType,
} from "@/lib/data/types";
import { scheduleInterviewAction } from "./actions";

export interface ApplicationOption {
  id: string;
  /** "Candidate — Job title (Stage)" */
  label: string;
}

export interface InterviewerOption {
  id: string;
  name: string;
  role: string;
}

const DURATIONS = [30, 45, 60, 90] as const;
type Duration = (typeof DURATIONS)[number];

/** Half-hour slots, 08:00–18:00. */
const TIME_SLOTS: string[] = Array.from({ length: 21 }, (_, i) => {
  const minutes = 8 * 60 + i * 30;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
});

function slotLabel(slot: string): string {
  const [hRaw, mRaw] = slot.split(":");
  const h = Number(hRaw);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${mRaw} ${period}`;
}

interface FormState {
  application_id: string;
  interviewer_id: string;
  date: string;
  time: string;
  interview_type: InterviewType;
  duration: Duration;
}

export interface ScheduleInterviewButtonProps {
  applications: ApplicationOption[];
  interviewers: InterviewerOption[];
  /** Default booking date (the demo "today"), YYYY-MM-DD. */
  defaultDate: string;
}

/**
 * "Schedule interview" trigger + modal. A double-booked slot is rejected by
 * the data layer (SLOT_TAKEN) and surfaces here as an inline error so the
 * user can simply pick another time.
 */
export function ScheduleInterviewButton({
  applications,
  interviewers,
  defaultDate,
}: ScheduleInterviewButtonProps) {
  const router = useRouter();
  const formId = useId();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(() => ({
    application_id: applications[0]?.id ?? "",
    interviewer_id: interviewers[0]?.id ?? "",
    date: defaultDate,
    time: "10:00",
    interview_type: "hr_interview",
    duration: 60,
  }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmation, setConfirmation] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function openModal() {
    setFieldErrors({});
    setFormError(null);
    setOpen(true);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);
    startTransition(async () => {
      const result = await scheduleInterviewAction({
        application_id: form.application_id,
        interviewer_id: form.interviewer_id,
        date: form.date,
        time: form.time,
        interview_type: form.interview_type,
        duration_minutes: form.duration,
      });
      if (result.ok) {
        setConfirmation(result.confirmation);
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
      {confirmation ? (
        <span
          className="inline-flex max-w-md items-center gap-1 truncate text-xs font-semibold text-primary-ink"
          role="status"
        >
          <Icon name="check" size={14} className="shrink-0" />
          <span className="truncate">Booked: {confirmation}</span>
        </span>
      ) : null}
      <Button onClick={openModal}>
        <Icon name="plus" size={15} />
        Schedule interview
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Schedule an interview"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              form={formId}
              loading={isPending}
              disabled={applications.length === 0}
            >
              Book interview
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

          {applications.length === 0 ? (
            <p className="mb-4 rounded-control border border-slate-200 bg-slate-50 px-3 py-2 text-[13px] text-slate-500">
              No candidates in an active stage yet. Add a candidate to a job, then
              come back to schedule an interview.
            </p>
          ) : null}

          <div className="mb-3.5">
            <Label htmlFor={`${formId}-app`} requiredMark>
              Candidate · role
            </Label>
            <Select
              id={`${formId}-app`}
              value={form.application_id}
              onChange={(e) => set("application_id", e.target.value)}
              invalid={Boolean(fieldErrors.application_id)}
              aria-describedby={fieldErrors.application_id ? `${formId}-app-err` : undefined}
              disabled={applications.length === 0}
            >
              {applications.map((app) => (
                <option key={app.id} value={app.id}>
                  {app.label}
                </option>
              ))}
            </Select>
            <FieldError id={`${formId}-app-err`}>{fieldErrors.application_id}</FieldError>
          </div>

          <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
            <div>
              <Label htmlFor={`${formId}-who`} requiredMark>
                Interviewer
              </Label>
              <Select
                id={`${formId}-who`}
                value={form.interviewer_id}
                onChange={(e) => set("interviewer_id", e.target.value)}
                invalid={Boolean(fieldErrors.interviewer_id)}
                aria-describedby={fieldErrors.interviewer_id ? `${formId}-who-err` : undefined}
              >
                {interviewers.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} — {person.role}
                  </option>
                ))}
              </Select>
              <FieldError id={`${formId}-who-err`}>{fieldErrors.interviewer_id}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${formId}-type`}>Interview type</Label>
              <Select
                id={`${formId}-type`}
                value={form.interview_type}
                onChange={(e) => set("interview_type", e.target.value as InterviewType)}
              >
                {INTERVIEW_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {INTERVIEW_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor={`${formId}-date`} requiredMark>
                Date
              </Label>
              <Input
                id={`${formId}-date`}
                type="date"
                value={form.date}
                onChange={(e) => set("date", e.target.value)}
                invalid={Boolean(fieldErrors.date)}
                aria-describedby={fieldErrors.date ? `${formId}-date-err` : undefined}
              />
              <FieldError id={`${formId}-date-err`}>{fieldErrors.date}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${formId}-time`} requiredMark>
                Time slot
              </Label>
              <Select
                id={`${formId}-time`}
                value={form.time}
                onChange={(e) => set("time", e.target.value)}
                invalid={Boolean(fieldErrors.time)}
                aria-describedby={fieldErrors.time ? `${formId}-time-err` : undefined}
              >
                {TIME_SLOTS.map((slot) => (
                  <option key={slot} value={slot}>
                    {slotLabel(slot)}
                  </option>
                ))}
              </Select>
              <FieldError id={`${formId}-time-err`}>{fieldErrors.time}</FieldError>
            </div>
            <div>
              <Label htmlFor={`${formId}-duration`}>Duration</Label>
              <Select
                id={`${formId}-duration`}
                value={form.duration}
                onChange={(e) => set("duration", Number(e.target.value) as Duration)}
              >
                {DURATIONS.map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <p className="mt-4 text-xs text-slate-500">
            Booking blocks the interviewer&apos;s slot on the team calendar and logs a
            confirmation email to the candidate. Double-booked slots are rejected
            automatically.
          </p>
        </form>
      </Modal>
    </div>
  );
}
