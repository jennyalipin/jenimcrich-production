"use client";

import { useState } from "react";
import { Badge, Card, CardBody, CardHeader, CardTitle, EmptyState, Select } from "@/components/ui";
import type { ActivityView } from "../_lib/view-types";

/** Activity tab: append-only audit trail with a type filter. */
export function ActivityTimeline({ entries }: { entries: ActivityView[] }) {
  const [filter, setFilter] = useState("");
  const types = [...new Set(entries.map((e) => e.type))];
  const visible = filter ? entries.filter((e) => e.type === filter) : entries;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Activity timeline{" "}
          <span className="text-[12px] font-normal text-slate-400">
            — every stage change, note, email and update
          </span>
        </CardTitle>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Filter activity by type"
          className="w-36 py-1.5 text-[13px]"
        >
          <option value="">All types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardBody>
        {visible.length === 0 ? (
          <EmptyState icon="🕘" title="No activity recorded" hint="Stage moves, notes and emails are logged here automatically." />
        ) : (
          <ol className="relative ml-2 space-y-4 border-l-2 border-slate-100 pl-5">
            {visible.map((entry) => (
              <li key={entry.id} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute -left-[26px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-primary shadow-card"
                />
                <p className="text-[13px] font-semibold text-slate-800">{entry.body}</p>
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12px] text-slate-400">
                  {entry.when} · {entry.actor} <Badge className="ml-0.5">{entry.type}</Badge>
                </p>
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}
