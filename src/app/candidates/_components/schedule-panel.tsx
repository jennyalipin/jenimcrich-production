"use client";

import { useMemo, useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  Input,
  Label,
  Select,
  cn,
  useToast,
  type BadgeVariant,
} from "@/components/ui";
import {
  INTERVIEW_TYPES,
  INTERVIEW_TYPE_LABELS,
  REFERENCE_NOW_ISO,
  type InterviewStatus,
  type InterviewType,
} from "@/lib/data/types";
import { bookInterview, cancelScheduledInterview } from "../actions";
import type { ApplicationOption, BookedSlot, InterviewView, InterviewerOption } from "../_lib/view-types";

/** Same half-hour grid the prototype offers (times are UTC in the demo). */
const SLOTS = ["09:00", "09:30", "10:00", "10:30", "11:00", "13:00", "13:30", "14:00", "15:00", "16:00"] as const;

const STATUS_VARIANT: Record<InterviewStatus, BadgeVariant> = {
  scheduled: "info",
  completed: "success",
  cancelled: "danger",
};
const STATUS_LABEL: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

function isoDatePlusDays(baseIso: string, days: number): string {
  const d = new Date(baseIso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Schedule tab: slot-grid booking (double-booking blocked) + interview list. */
export function SchedulePanel({
  applications,
  interviewers,
  interviews,
  bookedSlots,
}: {
  applications: ApplicationOption[];
  interviewers: InterviewerOption[];
  interviews: InterviewView[];
  bookedSlots: BookedSlot[];
}) {
  const toast = useToast();
  const today = REFERENCE_NOW_ISO.slice(0, 10);
  const [applicationId, setApplicationId] = useState(applications[0]?.id ?? "");
  const [interviewerId, setInterviewerId] = useState(interviewers[0]?.id ?? "");
  const [date, setDate] = useState(() => isoDatePlusDays(REFERENCE_NOW_ISO, 1));
  const [type, setType] = useState<InterviewType>("hr_interview");
  const [pendingSlot, setPendingSlot] = useState<string | null>(null);
  const [pendingCancel, setPendingCancel] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const takenInstants = useMemo(() => {
    const set = new Set<number>();
    for (const slot of bookedSlots) {
      if (slot.interviewerId === interviewerId) set.add(slot.startsAtMs);
    }
    return set;
  }, [bookedSlots, interviewerId]);

  function book(slot: string) {
    if (!date) {
      toast.error("Pick a date first.");
      return;
    }
    const startsAt = `${date}T${slot}:00.000Z`;
    setPendingSlot(slot);
    startTransition(async () => {
      const result = await bookInterview({
        application_id: applicationId,
        interviewer_id: interviewerId,
        starts_at: startsAt,
        interview_type: type,
      });
      setPendingSlot(null);
      if (result.ok) {
        toast.success("Interview booked — slot blocked and confirmation logged");
      } else {
        toast.error(result.error);
      }
    });
  }

  function cancel(interviewId: string) {
    setPendingCancel(interviewId);
    startTransition(async () => {
      const result = await cancelScheduledInterview(interviewId);
      setPendingCancel(null);
      if (result.ok) toast.success("Interview cancelled");
      else toast.error(result.error);
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="self-start">
        <CardHeader>
          <CardTitle>Book an interview</CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          {applications.length === 0 ? (
            <p className="text-[13px] text-slate-500">
              Interviews attach to an application — add this candidate to a role first.
            </p>
          ) : (
            <>
              {applications.length > 1 ? (
                <div>
                  <Label htmlFor="iv-application">Application</Label>
                  <Select
                    id="iv-application"
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
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="iv-date">Date</Label>
                  <Input
                    id="iv-date"
                    type="date"
                    min={today}
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="iv-type">Type</Label>
                  <Select
                    id="iv-type"
                    value={type}
                    onChange={(e) => setType(e.target.value as InterviewType)}
                  >
                    {INTERVIEW_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {INTERVIEW_TYPE_LABELS[t]}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>
              <div>
                <Label htmlFor="iv-interviewer">Interviewer</Label>
                <Select
                  id="iv-interviewer"
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
                <p className="micro-label mb-2 text-slate-500">
                  Available slots (UTC){" "}
                  <span className="font-normal normal-case text-slate-400">
                    — booked slots are blocked to prevent double-booking
                  </span>
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {SLOTS.map((slot) => {
                    const instant = Date.parse(`${date}T${slot}:00.000Z`);
                    const taken = takenInstants.has(instant);
                    return (
                      <Button
                        key={slot}
                        variant="ghost"
                        size="sm"
                        disabled={taken || !date}
                        loading={pendingSlot === slot}
                        onClick={() => book(slot)}
                        title={taken ? "This interviewer is already booked at this time" : `Book ${slot} UTC`}
                        className={cn("tabular-nums", taken && "line-through opacity-40")}
                      >
                        {slot}
                      </Button>
                    );
                  })}
                </div>
              </div>
              <p className="text-[12px] text-slate-400">
                Booking blocks the interviewer&apos;s calendar and logs a confirmation email to the
                candidate&apos;s history.
              </p>
            </>
          )}
        </CardBody>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Scheduled interviews</CardTitle>
        </CardHeader>
        <CardBody>
          {interviews.length === 0 ? (
            <EmptyState
              icon="📅"
              title="No interviews booked"
              hint="Pick a slot on the left to book the first interview."
            />
          ) : (
            <ul className="space-y-2.5">
              {interviews.map((iv) => (
                <li
                  key={iv.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-control border border-slate-200 bg-slate-50 px-3.5 py-3"
                >
                  <div>
                    <p className="text-[13px] font-semibold text-slate-800">{iv.typeLabel}</p>
                    <p className="text-[12px] text-slate-400">
                      {iv.when} · {iv.interviewer} · {iv.durationMinutes} min
                    </p>
                  </div>
                  <span className="flex items-center gap-2">
                    <Badge variant={STATUS_VARIANT[iv.status]}>{STATUS_LABEL[iv.status]}</Badge>
                    {iv.status === "scheduled" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={pendingCancel === iv.id}
                        onClick={() => cancel(iv.id)}
                      >
                        Cancel
                      </Button>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
