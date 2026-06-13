"use client";

import { useState, useTransition } from "react";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  EmptyState,
  FieldError,
  Input,
  Label,
  Select,
  Textarea,
  useToast,
} from "@/components/ui";
import { NOTE_CATEGORIES, NOTE_CATEGORY_LABELS, type NoteCategory } from "@/lib/data/types";
import { saveNote } from "../actions";
import type { NoteView } from "../_lib/view-types";

/** Notes tab: searchable categorized feed + add-note form (hiring team only). */
export function NotesPanel({ candidateId, notes }: { candidateId: string; notes: NoteView[] }) {
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NoteCategory>("general");
  const [body, setBody] = useState("");
  const [bodyError, setBodyError] = useState("");
  const [pending, startTransition] = useTransition();

  const visible = query.trim()
    ? notes.filter((n) =>
        `${n.body} ${n.author} ${n.categoryLabel}`.toLowerCase().includes(query.trim().toLowerCase()),
      )
    : notes;

  function submit() {
    setBodyError("");
    startTransition(async () => {
      const result = await saveNote({ candidate_id: candidateId, category, body });
      if (result.ok) {
        toast.success("Note saved");
        setBody("");
      } else {
        setBodyError(result.fieldErrors?.body ?? "");
        toast.error(result.error);
      }
    });
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
      <Card>
        <CardHeader>
          <CardTitle>
            Notes &amp; feedback{" "}
            <span className="text-[12px] font-normal text-slate-400">(visible to hiring team only)</span>
          </CardTitle>
        </CardHeader>
        <CardBody className="space-y-3">
          <Input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notes…"
            aria-label="Search notes"
          />
          {visible.length === 0 ? (
            <EmptyState
              icon="📝"
              title={query ? "No notes match this search" : "No notes yet"}
              hint={query ? "Try a different keyword." : "Save screening calls, interview observations and follow-ups here."}
            />
          ) : (
            <ul className="space-y-2.5">
              {visible.map((note) => (
                <li key={note.id} className="rounded-control border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Badge>{note.categoryLabel}</Badge>
                      <span className="text-[12.5px] font-semibold text-slate-700">{note.author}</span>
                    </span>
                    <span className="text-[12px] text-slate-400">{note.when}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-[13px] leading-relaxed text-slate-600">
                    {note.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card className="self-start">
        <CardHeader>
          <CardTitle>Add note</CardTitle>
        </CardHeader>
        <CardBody>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
            noValidate
            className="space-y-3"
          >
            <div>
              <Label htmlFor="note-category">Category</Label>
              <Select
                id="note-category"
                value={category}
                onChange={(e) => setCategory(e.target.value as NoteCategory)}
              >
                {NOTE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {NOTE_CATEGORY_LABELS[cat]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="note-body" requiredMark>
                Note
              </Label>
              <Textarea
                id="note-body"
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                invalid={Boolean(bodyError)}
                aria-describedby={bodyError ? "note-body-error" : undefined}
                placeholder="Interview observations, screening notes, follow-ups…"
              />
              <FieldError id="note-body-error">{bodyError}</FieldError>
            </div>
            <Button type="submit" loading={pending}>
              Save note
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
