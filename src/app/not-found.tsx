import Link from "next/link";
import { Card, CardBody, EmptyState, Icon } from "@/components/ui";

/** Global 404 — renders inside the app shell. */
export default function NotFound() {
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl">
        <CardBody>
          <EmptyState
            icon={<Icon name="search" size={20} />}
            title="Page not found"
            hint="That page doesn't exist, or the link is out of date. Try the dashboard or one of the sections in the sidebar."
            action={
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center rounded-control bg-[linear-gradient(180deg,#10b981_0%,#059669_100%)] px-4 py-2 text-[13.5px] font-semibold text-white shadow-[var(--shadow-button)] transition-[filter] hover:brightness-[1.05]"
              >
                Go to dashboard
              </Link>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
