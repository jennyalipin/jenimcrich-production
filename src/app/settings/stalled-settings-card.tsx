"use client";

import { useId, useState, useTransition } from "react";
import {
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Label,
  Select,
  cn,
  useToast,
} from "@/components/ui";
import {
  STALLED_DAY_OPTIONS,
  type Settings,
  type StalledDays,
} from "@/lib/data/types";
import { updateStalledSettings } from "./actions";

/**
 * Stalled-candidate reminders (domain rule 3): enable toggle + 3/5/7/10 day
 * threshold. Changes apply immediately (prototype behavior) with a toast.
 */
export function StalledSettingsCard({ settings }: { settings: Settings }) {
  const toast = useToast();
  const switchLabelId = useId();
  const selectId = useId();
  const [enabled, setEnabled] = useState(settings.stalled_enabled);
  const [days, setDays] = useState<StalledDays>(settings.stalled_days);
  const [isPending, startTransition] = useTransition();

  function apply(patch: { stalled_enabled?: boolean; stalled_days?: StalledDays }) {
    startTransition(async () => {
      const result = await updateStalledSettings(patch);
      if (result.ok && result.settings) {
        setEnabled(result.settings.stalled_enabled);
        setDays(result.settings.stalled_days);
        toast.success(result.message);
      } else {
        // Revert the optimistic value to what the server last confirmed.
        setEnabled(settings.stalled_enabled);
        setDays(settings.stalled_days);
        toast.error(result.message);
      }
    });
  }

  function handleToggle() {
    const next = !enabled;
    setEnabled(next);
    apply({ stalled_enabled: next });
  }

  function handleDaysChange(value: string) {
    const parsed = Number(value);
    const match = STALLED_DAY_OPTIONS.find((option) => option === parsed);
    if (match === undefined) return;
    setDays(match);
    apply({ stalled_days: match });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Stalled-candidate reminders</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center justify-between gap-4">
          <span id={switchLabelId} className="text-[13.5px] font-medium text-slate-700">
            Enable inactivity alerts
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby={switchLabelId}
            disabled={isPending}
            onClick={handleToggle}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full outline-none transition-colors duration-150 focus-visible:ring-[3px] focus-visible:ring-primary-soft disabled:opacity-55",
              enabled ? "bg-primary" : "bg-slate-300",
            )}
          >
            <span
              aria-hidden="true"
              className={cn(
                "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow-card transition-transform duration-150",
                enabled && "translate-x-5",
              )}
            />
          </button>
        </div>

        <div>
          <Label htmlFor={selectId}>Inactivity threshold</Label>
          <Select
            id={selectId}
            value={String(days)}
            disabled={isPending}
            onChange={(event) => handleDaysChange(event.target.value)}
          >
            {STALLED_DAY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option} days
              </option>
            ))}
          </Select>
        </div>

        <p className="text-[12.5px] leading-relaxed text-slate-500">
          Candidates with no stage movement, notes or emails within the
          threshold are flagged amber on the pipeline and surface in the
          dashboard&apos;s &ldquo;needs attention&rdquo; list. Hired and
          rejected candidates are excluded.
        </p>
      </CardBody>
    </Card>
  );
}
