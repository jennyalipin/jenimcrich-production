"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button, Card, CardBody, Icon, Input } from "@/components/ui";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/data/types";
import type { CandidateFilterState } from "../_lib/view-types";

function buildHref(state: CandidateFilterState): string {
  const params = new URLSearchParams();
  if (state.q.trim()) params.set("q", state.q.trim());
  for (const stage of state.stages) params.append("stage", stage);
  for (const tag of state.tags) params.append("tag", tag);
  if (state.flagged) params.set("flagged", "1");
  const qs = params.toString();
  return qs ? `/candidates?${qs}` : "/candidates";
}

function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

const checkboxClass =
  "h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

/** URL-driven filter rail: search, stage, tags, flagged. */
export function CandidateFilters({
  allTags,
  state,
}: {
  allTags: string[];
  state: CandidateFilterState;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [q, setQ] = useState(state.q);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adopt external URL changes (e.g. Clear filters) unless the user is typing.
  useEffect(() => {
    if (document.activeElement !== searchRef.current) setQ(state.q);
  }, [state.q]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  function navigate(next: CandidateFilterState) {
    startTransition(() => router.replace(buildHref(next), { scroll: false }));
  }

  function onSearch(value: string) {
    setQ(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate({ ...state, q: value }), 300);
  }

  const hasFilters = state.q !== "" || state.stages.length > 0 || state.tags.length > 0 || state.flagged;

  return (
    <Card className="w-full shrink-0 lg:w-60">
      <CardBody className="space-y-5">
        <div>
          <p className="micro-label mb-2 text-slate-500">Search</p>
          <Input
            ref={searchRef}
            type="search"
            value={q}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Name, skill, resume keyword…"
            aria-label="Search candidates"
          />
        </div>

        <fieldset>
          <legend className="micro-label mb-2 text-slate-500">Stage</legend>
          <div className="space-y-1.5">
            {STAGES.map((stage: Stage) => (
              <label key={stage} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
                <input
                  type="checkbox"
                  className={checkboxClass}
                  checked={state.stages.includes(stage)}
                  onChange={() => navigate({ ...state, stages: toggle(state.stages, stage) })}
                />
                {STAGE_LABELS[stage]}
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="micro-label mb-2 text-slate-500">Tags</legend>
          {allTags.length === 0 ? (
            <p className="text-[12px] text-slate-500">No tags yet</p>
          ) : (
            <div className="space-y-1.5">
              {allTags.map((tag) => (
                <label key={tag} className="flex cursor-pointer items-center gap-2 text-[13px] text-slate-600">
                  <input
                    type="checkbox"
                    className={checkboxClass}
                    checked={state.tags.includes(tag)}
                    onChange={() => navigate({ ...state, tags: toggle(state.tags, tag) })}
                  />
                  <span className="truncate">{tag}</span>
                </label>
              ))}
            </div>
          )}
        </fieldset>

        <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-slate-700">
          <input
            type="checkbox"
            className={checkboxClass}
            checked={state.flagged}
            onChange={() => navigate({ ...state, flagged: !state.flagged })}
          />
          <Icon name="star" size={14} fill className="text-amber-400" /> Flagged only
        </label>

        <Button
          variant="ghost"
          size="sm"
          block
          disabled={!hasFilters}
          onClick={() => {
            setQ("");
            navigate({ q: "", stages: [], tags: [], flagged: false });
          }}
        >
          Clear filters
        </Button>
      </CardBody>
    </Card>
  );
}
