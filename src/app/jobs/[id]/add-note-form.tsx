"use client";

import { useId, useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, FieldError, Input } from "@/components/ui";
import { addJobNoteAction } from "../actions";

/** Inline "add hiring-manager note" form on the job detail page. */
export function AddJobNoteForm({ jobId }: { jobId: string }) {
  const router = useRouter();
  const errorId = useId();
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await addJobNoteAction({ job_id: jobId, body });
      if (result.ok) {
        setBody("");
        router.refresh();
      } else {
        setError(
          result.formError ??
            Object.values(result.fieldErrors ?? {})[0] ??
            "The note could not be saved. Please try again.",
        );
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3" noValidate>
      <div className="flex gap-2">
        <Input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Add a hiring manager note — e.g. “HM now prefers candidates with kiln experience”"
          aria-label="New hiring manager note"
          invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
          className="flex-1"
        />
        <Button type="submit" loading={isPending} className="shrink-0">
          Add note
        </Button>
      </div>
      <FieldError id={errorId}>{error}</FieldError>
    </form>
  );
}
