"use client";

import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type Announcements,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useOptimistic, useRef, useState, useTransition } from "react";
import {
  Button,
  EmptyState,
  ScorePill,
  Select,
  ToastProvider,
  cn,
  useToast,
} from "@/components/ui";
import { STAGES, STAGE_LABELS, type Stage } from "@/lib/data/types";
import { moveStageAction } from "./actions";

/* ------------------------------------------------------------------ */
/* Props (plain, serializable — computed by the Server Component page) */
/* ------------------------------------------------------------------ */

export interface BoardCard {
  applicationId: string;
  candidateId: string;
  jobId: string;
  candidateName: string;
  flagged: boolean;
  jobTitle: string;
  /** Job has a restrictive visa requirement → render 🛂 (domain rule 4). */
  restrictiveVisa: boolean;
  /** Match score vs this card's own job (domain rule 2). */
  score: number;
  stage: Stage;
  daysInStage: number;
  /** Domain rule 3 — amber edge on the card. */
  isStalled: boolean;
}

export interface JobOption {
  id: string;
  label: string;
}

export interface PipelineBoardProps {
  cards: BoardCard[];
  jobs: JobOption[];
  stalledDays: number;
  stalledEnabled: boolean;
}

/** Board entry point — mounts its own ToastProvider (not in the app shell). */
export function PipelineBoard(props: PipelineBoardProps) {
  return (
    <ToastProvider>
      <BoardInner {...props} />
    </ToastProvider>
  );
}

/* ------------------------------------------------------------------ */
/* Board                                                               */
/* ------------------------------------------------------------------ */

const ALL_JOBS = "all";

function BoardInner({ cards: initialCards, jobs, stalledDays, stalledEnabled }: PipelineBoardProps) {
  const [jobFilter, setJobFilter] = useState<string>(ALL_JOBS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();

  // Optimistic board state: the move shows instantly; once the server action
  // settles, React falls back to the (revalidated) server props — which also
  // auto-reverts the card if the move failed.
  const [cards, applyOptimisticMove] = useOptimistic(
    initialCards,
    (current: BoardCard[], move: { applicationId: string; stage: Stage }) => {
      const moved = current.find((c) => c.applicationId === move.applicationId);
      if (!moved) return current;
      // Re-stage and append: columns are ordered oldest-in-stage first.
      const rest = current.filter((c) => c.applicationId !== move.applicationId);
      return [...rest, { ...moved, stage: move.stage, daysInStage: 0, isStalled: false }];
    },
  );

  // Suppress the post-drag click so a drop never opens the profile.
  const justDragged = useRef(false);

  const visibleCards = useMemo(
    () => (jobFilter === ALL_JOBS ? cards : cards.filter((c) => c.jobId === jobFilter)),
    [cards, jobFilter],
  );

  const byStage = useMemo(() => {
    const grouped: Record<Stage, BoardCard[]> = {
      applied: [], screening: [], interview: [], offer: [], hired: [], rejected: [],
    };
    for (const card of visibleCards) grouped[card.stage].push(card);
    return grouped;
  }, [visibleCards]);

  const activeCard = activeId
    ? cards.find((c) => c.applicationId === activeId) ?? null
    : null;

  const sensors = useSensors(
    // Distance constraint keeps plain clicks (open profile) working.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  function openProfile(card: BoardCard) {
    if (justDragged.current) return;
    router.push(`/candidates/${card.candidateId}`);
  }

  function handleDragStart(event: DragStartEvent) {
    setActiveId(String(event.active.id));
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    justDragged.current = true;
    window.setTimeout(() => {
      justDragged.current = false;
    }, 150);

    const { active, over } = event;
    if (!over) return;
    const targetStage = over.id as Stage;
    const card = cards.find((c) => c.applicationId === String(active.id));
    if (!card || card.stage === targetStage) return;

    startTransition(async () => {
      applyOptimisticMove({ applicationId: card.applicationId, stage: targetStage });
      const result = await moveStageAction({
        applicationId: card.applicationId,
        stage: targetStage,
      });
      if (result.ok) {
        toast.success(
          `${result.candidateName} → ${STAGE_LABELS[result.stage]} (status updated & logged)`,
        );
      } else {
        // Base props were never revalidated, so the card snaps back on its own.
        toast.error(result.error);
      }
    });
  }

  /* Pointer drags use pointer position; keyboard drags have no pointer, so
     fall back to rect intersection. Columns are the only droppables. */
  const collisionDetection: CollisionDetection = (args) => {
    const withPointer = pointerWithin(args);
    return withPointer.length > 0 ? withPointer : rectIntersection(args);
  };

  const announcements: Announcements = {
    onDragStart({ active }) {
      return `Picked up ${nameOf(String(active.id))}.`;
    },
    onDragOver({ active, over }) {
      return over
        ? `${nameOf(String(active.id))} is over the ${stageLabel(over.id)} column.`
        : undefined;
    },
    onDragEnd({ active, over }) {
      return over
        ? `${nameOf(String(active.id))} dropped on ${stageLabel(over.id)}.`
        : `${nameOf(String(active.id))} dropped.`;
    },
    onDragCancel({ active }) {
      return `Moving ${nameOf(String(active.id))} was cancelled.`;
    },
  };

  function nameOf(applicationId: string): string {
    return cards.find((c) => c.applicationId === applicationId)?.candidateName ?? "candidate";
  }

  function stageLabel(id: string | number): string {
    return STAGE_LABELS[id as Stage] ?? String(id);
  }

  const filteringJob = jobFilter !== ALL_JOBS;

  return (
    <div className="flex flex-col gap-4">
      {/* Header row: helper copy + job filter + list-view link */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-2xl text-[12.5px] leading-relaxed text-slate-500">
          Drag candidate cards between stages — status updates automatically and is
          logged to the activity trail.
          {stalledEnabled ? (
            <>
              {" "}
              <span className="font-semibold text-warning-ink">Amber edge</span> = stalled ≥{" "}
              {stalledDays}d.
            </>
          ) : null}
        </p>
        <div className="flex items-center gap-2">
          <label htmlFor="pipeline-job-filter" className="micro-label text-slate-500">
            Job
          </label>
          <Select
            id="pipeline-job-filter"
            value={jobFilter}
            onChange={(e) => setJobFilter(e.target.value)}
            className="w-64 max-w-full"
          >
            <option value={ALL_JOBS}>All jobs ({cards.length})</option>
            {jobs.map((job) => (
              <option key={job.id} value={job.id}>
                {job.label}
              </option>
            ))}
          </Select>
          <Link
            href="/candidates"
            className="inline-flex shrink-0 items-center gap-1 rounded-control px-2.5 py-2 text-[12.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-200/70 hover:text-ink"
          >
            List view →
          </Link>
        </div>
      </div>

      {visibleCards.length === 0 ? (
        <div className="rounded-card border border-slate-200 bg-surface shadow-card">
          <EmptyState
            icon="🗂️"
            title={filteringJob ? "No candidates for this job yet" : "No applications yet"}
            hint={
              filteringJob
                ? "Try another job, or clear the filter to see the whole pipeline."
                : "Add candidates and link them to a job to start tracking them here."
            }
            action={
              filteringJob ? (
                <Button variant="secondary" size="sm" onClick={() => setJobFilter(ALL_JOBS)}>
                  Show all jobs
                </Button>
              ) : (
                <Link
                  href="/candidates"
                  className="inline-flex items-center rounded-control bg-primary px-3 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-primary-strong"
                >
                  Go to candidates
                </Link>
              )
            }
          />
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={collisionDetection}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onDragCancel={() => setActiveId(null)}
          accessibility={{
            announcements,
            screenReaderInstructions: {
              draggable:
                "To pick up a candidate card, press space or enter. Use the arrow keys to move it over a stage column, then press space or enter again to drop it. Press escape to cancel.",
            },
          }}
        >
          <div className="scrollbar-slim flex items-start gap-3.5 overflow-x-auto pb-3">
            {STAGES.map((stage) => (
              <StageColumn
                key={stage}
                stage={stage}
                cards={byStage[stage]}
                onOpen={openProfile}
              />
            ))}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeCard ? (
              <div className="w-60 rotate-2 cursor-grabbing">
                <CardFace card={activeCard} overlay />
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Column                                                              */
/* ------------------------------------------------------------------ */

function StageColumn({
  stage,
  cards,
  onOpen,
}: {
  stage: Stage;
  cards: BoardCard[];
  onOpen: (card: BoardCard) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });

  return (
    <section
      ref={setNodeRef}
      aria-label={`${STAGE_LABELS[stage]} — ${cards.length} candidate${cards.length === 1 ? "" : "s"}`}
      className={cn(
        "w-60 shrink-0 rounded-card border border-slate-200 bg-slate-100/80 transition-colors",
        isOver && "-outline-offset-2 bg-primary-faint outline-2 outline-dashed outline-primary",
      )}
    >
      <header className="flex items-center justify-between border-b border-slate-200 px-3.5 py-2.5">
        <h2 className="text-[13px] font-bold text-slate-700">{STAGE_LABELS[stage]}</h2>
        <span className="rounded-full bg-slate-200 px-2 py-px text-[11.5px] font-semibold tabular-nums text-slate-600">
          {cards.length}
        </span>
      </header>
      <div className="flex min-h-[120px] flex-col gap-2 p-2.5">
        {cards.map((card) => (
          <DraggableCard key={card.applicationId} card={card} onOpen={onOpen} />
        ))}
        {cards.length === 0 ? (
          <p className="grid min-h-[96px] place-items-center rounded-[10px] border border-dashed border-slate-300 px-3 text-center text-[11.5px] text-slate-400">
            Drop candidates here
          </p>
        ) : null}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Card                                                                */
/* ------------------------------------------------------------------ */

function DraggableCard({
  card,
  onOpen,
}: {
  card: BoardCard;
  onOpen: (card: BoardCard) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: card.applicationId,
    data: { stage: card.stage },
  });

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      onClick={() => onOpen(card)}
      className={cn("touch-none", isDragging && "opacity-40")}
    >
      <CardFace card={card} />
    </div>
  );
}

/** Visual card body — reused by the in-column card and the drag overlay. */
function CardFace({ card, overlay = false }: { card: BoardCard; overlay?: boolean }) {
  return (
    <article
      className={cn(
        "cursor-grab rounded-[10px] border border-slate-200 bg-surface px-3 py-2.5 shadow-card active:cursor-grabbing",
        card.isStalled && "border-l-[3px] border-l-warning ring-1 ring-warning-soft",
        overlay && "shadow-raised",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[13px] font-bold text-ink">
          {card.flagged ? <span aria-label="Flagged candidate">⭐ </span> : null}
          {/* Real link so keyboard users can open the profile (Enter on the
              card itself lifts it for dragging). */}
          <Link
            href={`/candidates/${card.candidateId}`}
            className="rounded-xs hover:underline"
            onClick={(e) => e.stopPropagation()}
            tabIndex={overlay ? -1 : 0}
          >
            {card.candidateName}
          </Link>
        </span>
        <ScorePill
          score={card.score}
          className="min-w-[34px] px-1.5 text-[11px]"
          label={`Match score for ${card.jobTitle}`}
        />
      </div>
      <div className="mt-0.5 truncate text-[11.5px] text-slate-500">
        {card.jobTitle}
        {card.restrictiveVisa ? (
          <span title="Restrictive visa requirement on this job" aria-label="Restrictive visa requirement">
            {" "}
            🛂
          </span>
        ) : null}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px]">
        <span className="tabular-nums text-slate-400">{card.daysInStage}d in stage</span>
        {card.isStalled ? (
          <span className="font-bold text-warning-ink">⚠ stalled</span>
        ) : null}
      </div>
    </article>
  );
}
