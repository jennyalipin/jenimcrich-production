import Link from "next/link";
import { Card, CardBody, EmptyState, Icon } from "@/components/ui";

export default function CandidateNotFound() {
  return (
    <div className="p-6">
      <Card className="mx-auto max-w-xl">
        <CardBody>
          <EmptyState
            icon={<Icon name="search" size={20} />}
            title="Candidate not found"
            hint="This profile may have been removed, or the link is out of date."
            action={
              <Link
                href="/candidates"
                className="inline-flex items-center justify-center rounded-control bg-primary px-4 py-2 text-[13.5px] font-semibold text-white transition-colors hover:bg-primary-strong"
              >
                Back to candidates
              </Link>
            }
          />
        </CardBody>
      </Card>
    </div>
  );
}
