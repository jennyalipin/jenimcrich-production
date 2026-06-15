"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button, Card, CardBody, EmptyState, Icon } from "@/components/ui";

/**
 * Route-level error boundary. Renders inside the app shell, so the sidebar and
 * topbar stay put — only the page content is replaced. Copy is written for a
 * non-technical owner: say what happened and what to do next, no stack traces.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface to the console for debugging. Never log candidate PII here —
    // `error.message` can carry a sanitized-but-not-guaranteed DB/string
    // detail, so log only the server-side digest (a safe lookup id).
    console.error("Page error", error.digest ?? "(no digest)");
  }, [error]);

  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl">
        <CardBody>
          <EmptyState
            icon={<Icon name="alert" size={20} />}
            title="Something went wrong on this page"
            hint="The page didn't load correctly. You can try again, or head back to the dashboard. If this keeps happening, let us know."
            action={
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button onClick={reset}>Try again</Button>
                <Link
                  href="/dashboard"
                  className="inline-flex items-center justify-center rounded-control border border-slate-300 bg-white px-4 py-2 text-[13.5px] font-semibold text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800"
                >
                  Go to dashboard
                </Link>
              </div>
            }
          />
          {error.digest ? (
            <p className="mt-4 text-center text-[11.5px] text-slate-400">
              Reference code: {error.digest}
            </p>
          ) : null}
        </CardBody>
      </Card>
    </div>
  );
}
