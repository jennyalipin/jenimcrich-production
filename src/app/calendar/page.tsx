import Link from "next/link";
import {
  Badge,
  Card,
  CardHeader,
  CardTitle,
  EmptyState,
  Icon,
  badgeBaseClass,
  cn,
  type BadgeVariant,
} from "@/components/ui";
import {
  ACTIVE_STAGES,
  INTERVIEW_TYPE_LABELS,
  REFERENCE_NOW_ISO,
  STAGE_LABELS,
  getApplicationsByStage,
  getInterviewers,
  getInterviews,
  type InterviewStatus,
  type InterviewType,
  type InterviewWithRelations,
} from "@/lib/data";
import { formatDayLabel, formatTime } from "@/lib/format";
import {
  ScheduleInterviewButton,
  type ApplicationOption,
} from "./schedule-interview";

const DAY_MS = 86_400_000;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Event chip + badge tint per interview type (cyan accent = technical, like
 *  the Interview stage hue; emerald = final panel; blue = HR; amber = client). */
const typeChipClass: Record<InterviewType, string> = {
  hr_interview: "bg-info-soft text-info-ink",
  technical: "bg-interview-soft text-interview-ink",
  final_panel: "bg-primary-soft text-primary-ink",
  client_interview: "bg-warning-soft text-warning-ink",
};

const STATUS_LABELS: Record<InterviewStatus, string> = {
  scheduled: "Scheduled",
  completed: "Completed",
  cancelled: "Cancelled",
};

const statusVariant: Record<InterviewStatus, BadgeVariant> = {
  scheduled: "info",
  completed: "success",
  cancelled: "danger",
};

interface DayCell {
  dateKey: string; // YYYY-MM-DD (UTC)
  dayOfMonth: number;
  inMonth: boolean;
}

/** Sunday-aligned UTC month grid (full weeks). */
function monthGrid(month: string): DayCell[] {
  const [y, m] = month.split("-").map(Number) as [number, number];
  const monthStartMs = Date.UTC(y, m - 1, 1);
  const firstDow = new Date(monthStartMs).getUTCDay();
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const gridStartMs = monthStartMs - firstDow * DAY_MS;
  const cellCount = Math.ceil((firstDow + daysInMonth) / 7) * 7;

  return Array.from({ length: cellCount }, (_, i) => {
    const date = new Date(gridStartMs + i * DAY_MS);
    const dateKey = date.toISOString().slice(0, 10);
    return {
      dateKey,
      dayOfMonth: date.getUTCDate(),
      inMonth: dateKey.slice(0, 7) === month,
    };
  });
}

function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number) as [number, number];
  return new Date(Date.UTC(y, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${month}-01T00:00:00.000Z`));
}

function TypeBadge({ type }: { type: InterviewType }) {
  return (
    <span className={cn(badgeBaseClass, typeChipClass[type])}>
      {INTERVIEW_TYPE_LABELS[type]}
    </span>
  );
}

const navLinkClass =
  "inline-flex items-center justify-center rounded-control border border-slate-300 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-800";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string | string[] }>;
}) {
  const params = await searchParams;
  const todayKey = REFERENCE_NOW_ISO.slice(0, 10);
  const currentMonth = todayKey.slice(0, 7);
  const month =
    typeof params.month === "string" && MONTH_RE.test(params.month)
      ? params.month
      : currentMonth;

  const [interviews, appsByStage, interviewers] = await Promise.all([
    getInterviews(),
    getApplicationsByStage(),
    getInterviewers(),
  ]);

  // --- Month grid (scheduled interviews only, like the prototype) ----------
  const cells = monthGrid(month);
  const eventsByDay = new Map<string, InterviewWithRelations[]>();
  for (const iv of interviews) {
    if (iv.status !== "scheduled") continue;
    const key = iv.starts_at.slice(0, 10);
    const list = eventsByDay.get(key);
    if (list) list.push(iv);
    else eventsByDay.set(key, [iv]);
  }
  const scheduledThisMonth = interviews.filter(
    (iv) => iv.status === "scheduled" && iv.starts_at.slice(0, 7) === month,
  ).length;

  // --- Week list: the (Sun–Sat) week around the demo "today", all statuses -
  const todayMs = Date.parse(`${todayKey}T00:00:00.000Z`);
  const weekStartMs = todayMs - new Date(todayMs).getUTCDay() * DAY_MS;
  const weekEndMs = weekStartMs + 7 * DAY_MS;
  const weekInterviews = interviews.filter((iv) => {
    const t = Date.parse(iv.starts_at);
    return t >= weekStartMs && t < weekEndMs;
  });

  // --- Options for the booking modal ----------------------------------------
  const applicationOptions: ApplicationOption[] = ACTIVE_STAGES.flatMap((stage) =>
    appsByStage[stage].map((app) => ({
      id: app.id,
      label: `${app.candidate.full_name} — ${app.job.title} (${STAGE_LABELS[stage]})`,
    })),
  );

  return (
    <div className="p-6">
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Link
            href={`/calendar?month=${shiftMonth(month, -1)}`}
            aria-label="Previous month"
            className={navLinkClass}
          >
            ←
          </Link>
          <h2 className="min-w-36 text-center text-base font-bold tracking-tight text-ink">
            {monthLabel(month)}
          </h2>
          <Link
            href={`/calendar?month=${shiftMonth(month, 1)}`}
            aria-label="Next month"
            className={navLinkClass}
          >
            →
          </Link>
          {month !== currentMonth ? (
            <Link
              href="/calendar"
              className="ml-1 text-[13px] font-semibold text-primary hover:underline"
            >
              Today
            </Link>
          ) : null}
          <span className="ml-2 text-[13px] text-slate-500">
            {scheduledThisMonth} interview{scheduledThisMonth === 1 ? "" : "s"} scheduled
          </span>
        </div>
        <ScheduleInterviewButton
          applications={applicationOptions}
          interviewers={interviewers}
          defaultDate={todayKey}
        />
      </div>

      {/* Type legend */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(Object.keys(typeChipClass) as InterviewType[]).map((type) => (
          <TypeBadge key={type} type={type} />
        ))}
      </div>

      {/* Month grid */}
      <Card className="mt-3 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="micro-label border-r border-slate-200 px-2 py-2 text-center text-slate-500 last:border-r-0"
            >
              {day}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {cells.map((cell) => {
            const events = eventsByDay.get(cell.dateKey) ?? [];
            const isToday = cell.dateKey === todayKey;
            return (
              <div
                key={cell.dateKey}
                className={cn(
                  "min-h-24 border-b border-r border-slate-200 p-1.5 [&:nth-child(7n)]:border-r-0 [&:nth-last-child(-n+7)]:border-b-0",
                  cell.inMonth ? "bg-surface" : "bg-slate-50",
                )}
              >
                <span
                  className={cn(
                    "inline-flex size-[22px] items-center justify-center text-xs font-semibold",
                    isToday
                      ? "rounded-full bg-primary text-white"
                      : cell.inMonth
                        ? "text-slate-500"
                        : "text-slate-300",
                  )}
                >
                  {cell.dayOfMonth}
                </span>
                {events.map((event) => (
                  <Link
                    key={event.id}
                    href={`/candidates/${event.candidate_id}`}
                    title={`${event.candidate.full_name} — ${INTERVIEW_TYPE_LABELS[event.interview_type]} with ${event.interviewer_name}`}
                    className={cn(
                      "mt-1 block truncate rounded-[5px] px-1.5 py-0.5 text-[10.5px] font-semibold leading-4 hover:opacity-80",
                      typeChipClass[event.interview_type],
                    )}
                  >
                    {formatTime(event.starts_at)} {event.candidate.full_name.split(" ")[0]}
                  </Link>
                ))}
              </div>
            );
          })}
        </div>
      </Card>

      {/* This week */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>This week</CardTitle>
          <span className="text-xs text-slate-500">
            Pulled live from candidate records · {formatDayLabel(weekStartMs)} –{" "}
            {formatDayLabel(weekEndMs - DAY_MS)}
          </span>
        </CardHeader>
        {weekInterviews.length > 0 ? (
          <ul>
            {weekInterviews.map((iv) => {
              const isToday = iv.starts_at.slice(0, 10) === todayKey;
              return (
                <li
                  key={iv.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 border-b border-slate-100 px-5 py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="text-[13.5px]">
                      <Link
                        href={`/candidates/${iv.candidate_id}`}
                        className="font-semibold text-ink hover:text-primary hover:underline"
                      >
                        {iv.candidate.full_name}
                      </Link>{" "}
                      <span className="text-slate-400">·</span>{" "}
                      <span className="text-slate-600">{iv.job.title}</span>
                    </p>
                    <p
                      className={cn(
                        "mt-0.5 text-xs",
                        iv.status === "cancelled" ? "text-slate-400 line-through" : "text-slate-500",
                      )}
                    >
                      {isToday ? (
                        <span className="font-bold text-primary-ink">Today</span>
                      ) : (
                        formatDayLabel(iv.starts_at)
                      )}{" "}
                      · {formatTime(iv.starts_at)} · {iv.duration_minutes} min · with{" "}
                      {iv.interviewer_name}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <TypeBadge type={iv.interview_type} />
                    <Badge variant={statusVariant[iv.status]}>{STATUS_LABELS[iv.status]}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            icon={<Icon name="interview" size={20} />}
            title="No interviews this week"
            hint="Use Schedule interview to book a candidate into an interviewer's slot."
          />
        )}
      </Card>
    </div>
  );
}
