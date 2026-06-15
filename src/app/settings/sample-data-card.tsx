"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Input,
  Modal,
  useToast,
} from "@/components/ui";
import { clearSampleData } from "./actions";

/**
 * Owner-only "start fresh" control: permanently clears the seeded sample
 * candidates, jobs and activity. Irreversible, so it asks the user to type
 * CLEAR before the wipe runs. Templates and settings are kept.
 */
export function SampleDataCard() {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();

  const armed = confirmText.trim().toUpperCase() === "CLEAR";

  function close() {
    if (isPending) return;
    setOpen(false);
    setConfirmText("");
  }

  function handleClear() {
    if (!armed) return;
    startTransition(async () => {
      const result = await clearSampleData();
      if (result.ok) {
        toast.success(result.message);
        setOpen(false);
        setConfirmText("");
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Sample data</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          Your workspace was set up with sample candidates, jobs and activity so
          you can explore every feature. When you&apos;re ready to use it for
          real, clear the sample data to start fresh — your email templates and
          settings are kept.
        </p>
        <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
          Clear sample data
        </Button>
      </CardBody>

      <Modal
        open={open}
        onClose={close}
        title="Clear sample data?"
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="ghost" onClick={close} disabled={isPending}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={isPending}
              disabled={!armed}
              onClick={handleClear}
            >
              Clear sample data
            </Button>
          </>
        }
      >
        <div className="space-y-3.5">
          <p className="text-[13.5px] leading-relaxed text-slate-600">
            This permanently removes all sample candidates, jobs, applications,
            interviews, notes and email history. Your email templates and
            settings are kept. This can&apos;t be undone.
          </p>
          <div>
            <label
              htmlFor="clear-confirm"
              className="text-[12.5px] font-medium text-slate-600"
            >
              Type <span className="font-mono font-semibold text-ink">CLEAR</span>{" "}
              to confirm
            </label>
            <Input
              id="clear-confirm"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="CLEAR"
              autoComplete="off"
              className="mt-1.5"
            />
          </div>
        </div>
      </Modal>
    </Card>
  );
}
