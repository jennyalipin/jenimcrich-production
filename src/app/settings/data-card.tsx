"use client";

import { useState, useTransition } from "react";
import {
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Modal,
  useToast,
} from "@/components/ui";
import { resetDemo } from "./actions";

/** Demo-data explainer + destructive "reset to seed" with confirmation. */
export function DataCard() {
  const toast = useToast();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleReset() {
    startTransition(async () => {
      const result = await resetDemo();
      if (result.ok) {
        setConfirmOpen(false);
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data</CardTitle>
      </CardHeader>
      <CardBody className="space-y-4">
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          This workspace runs on the demo data layer: jobs, candidates and
          templates are seeded in server memory while Supabase is being
          provisioned. Edits apply instantly for everyone viewing the demo and
          re-seed when the server restarts.
        </p>
        <Button variant="danger" size="sm" onClick={() => setConfirmOpen(true)}>
          Reset demo data
        </Button>
      </CardBody>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Reset demo data?"
        closeOnBackdrop={false}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={isPending} onClick={handleReset}>
              Reset everything
            </Button>
          </>
        }
      >
        <p className="text-[13.5px] leading-relaxed text-slate-600">
          All jobs, candidates, applications, notes, interviews and email
          history will be restored to the original demo seed. Any changes you
          made in this session will be lost.
        </p>
      </Modal>
    </Card>
  );
}
