"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import { Button, Tab, TabList, TabPanel, Tabs, type ButtonVariant } from "@/components/ui";

const TabJumpContext = createContext<((tab: string) => void) | null>(null);

/**
 * Candidate profile tab frame. Panels arrive as server-rendered nodes
 * (children-as-props), so the page stays a Server Component while tab
 * switching is instant on the client. Server content inside a panel can
 * jump between tabs with <TabJumpButton> (e.g. Overview → Schedule).
 */
export function CandidateTabs({
  counts,
  overview,
  notes,
  scorecards,
  documents,
  schedule,
  activity,
}: {
  counts: { notes: number; scorecards: number; documents: number; schedule: number };
  overview: ReactNode;
  notes: ReactNode;
  scorecards: ReactNode;
  documents: ReactNode;
  schedule: ReactNode;
  activity: ReactNode;
}) {
  const [tab, setTab] = useState("overview");

  return (
    <TabJumpContext value={setTab}>
      <Tabs value={tab} onChange={setTab}>
        <TabList aria-label="Candidate sections">
          <Tab value="overview">Overview</Tab>
          <Tab value="notes" count={counts.notes}>
            Notes
          </Tab>
          <Tab value="scorecards" count={counts.scorecards}>
            Scorecards
          </Tab>
          <Tab value="documents" count={counts.documents}>
            Documents
          </Tab>
          <Tab value="schedule" count={counts.schedule}>
            Schedule
          </Tab>
          <Tab value="activity">Activity</Tab>
        </TabList>
        <TabPanel value="overview">{overview}</TabPanel>
        <TabPanel value="notes">{notes}</TabPanel>
        <TabPanel value="scorecards">{scorecards}</TabPanel>
        <TabPanel value="documents">{documents}</TabPanel>
        <TabPanel value="schedule">{schedule}</TabPanel>
        <TabPanel value="activity">{activity}</TabPanel>
      </Tabs>
    </TabJumpContext>
  );
}

/** Button that switches the surrounding CandidateTabs to another tab. */
export function TabJumpButton({
  tab,
  children,
  variant = "ghost",
}: {
  tab: string;
  children: ReactNode;
  variant?: ButtonVariant;
}) {
  const jump = useContext(TabJumpContext);
  return (
    <Button variant={variant} size="sm" onClick={() => jump?.(tab)}>
      {children}
    </Button>
  );
}
