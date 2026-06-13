import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/login/actions";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  Icon,
  ToastProvider,
} from "@/components/ui";
import { getSettings } from "@/lib/data";
import { DEMO_USER } from "@/lib/demo-auth";
import { initials } from "@/lib/format";
import { DataCard } from "./data-card";
import { StalledSettingsCard } from "./stalled-settings-card";

export const metadata: Metadata = {
  title: "Settings — JeniMcRich Recruitment",
};

/** Permissions matrix from CLAUDE.md domain rule 7 / the RLS policy sketch. */
const ROLE_MATRIX: ReadonlyArray<{
  capability: string;
  admin: boolean;
  recruiter: boolean;
  hiringManager: boolean;
}> = [
  { capability: "View candidates, jobs & analytics", admin: true, recruiter: true, hiringManager: true },
  { capability: "Edit job details & add job notes", admin: true, recruiter: false, hiringManager: true },
  { capability: "Manage candidates & move pipeline cards", admin: true, recruiter: true, hiringManager: false },
  { capability: "Schedule interviews & send candidate email", admin: true, recruiter: true, hiringManager: false },
  { capability: "Submit interview scorecards", admin: true, recruiter: true, hiringManager: true },
  { capability: "Manage & approve email templates", admin: true, recruiter: false, hiringManager: false },
  { capability: "Delete jobs & clients", admin: true, recruiter: false, hiringManager: false },
];

function Allowed({ allowed }: { allowed: boolean }) {
  return allowed ? (
    <span className="inline-flex justify-center text-primary">
      <Icon name="check" size={16} />
      <span className="sr-only">Allowed</span>
    </span>
  ) : (
    <span className="text-slate-300">
      <span aria-hidden="true">—</span>
      <span className="sr-only">Not allowed</span>
    </span>
  );
}

function ProfileCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <Badge variant="info">Demo account</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <div className="flex items-center gap-3.5">
          <div
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary-soft text-[15px] font-bold text-primary-ink"
          >
            {initials(DEMO_USER.name)}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[14.5px] font-semibold text-ink">
                {DEMO_USER.name}
              </span>
              <Badge variant="success">Admin</Badge>
            </div>
            <div className="truncate text-[12.5px] text-slate-500">{DEMO_USER.email}</div>
          </div>
        </div>
        <p className="text-[12.5px] leading-relaxed text-slate-500">
          You are signed in with the demo session. Real accounts, roles and
          row-level security arrive with Supabase Auth.
        </p>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
      </CardBody>
    </Card>
  );
}

function RolesCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles &amp; permissions</CardTitle>
        <Badge>Preview</Badge>
      </CardHeader>
      <CardBody>
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-slate-200 text-left">
              <th scope="col" className="micro-label pb-2 pr-2 text-slate-500">
                Capability
              </th>
              <th scope="col" className="micro-label px-3 pb-2 text-center text-slate-500">
                Admin
              </th>
              <th scope="col" className="micro-label px-3 pb-2 text-center text-slate-500">
                Recruiter
              </th>
              <th scope="col" className="micro-label px-3 pb-2 text-center text-slate-500">
                Hiring Mgr
              </th>
            </tr>
          </thead>
          <tbody>
            {ROLE_MATRIX.map((row) => (
              <tr key={row.capability} className="border-b border-slate-100 last:border-0">
                <td className="py-2 pr-2 text-slate-700">{row.capability}</td>
                <td className="px-3 py-2 text-center">
                  <Allowed allowed={row.admin} />
                </td>
                <td className="px-3 py-2 text-center">
                  <Allowed allowed={row.recruiter} />
                </td>
                <td className="px-3 py-2 text-center">
                  <Allowed allowed={row.hiringManager} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-3 text-[12.5px] leading-relaxed text-slate-500">
          Enforced with Supabase Row Level Security once auth is connected —
          permissions are checked in the database, not just hidden in the UI.
        </p>
      </CardBody>
    </Card>
  );
}

function RoadmapCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Production roadmap</CardTitle>
      </CardHeader>
      <CardBody>
        <ul className="space-y-2 text-[13px] text-slate-600">
          {[
            "Supabase: auth, multi-user roles, file storage with signed URLs",
            "Real email via Resend with delivery & open tracking",
            "Resume parsing — PDF text extraction + LLM structuring",
            "Google Calendar two-way interview sync",
            "E-signature for offer letters (Dropbox Sign)",
          ].map((item) => (
            <li key={item} className="flex gap-2">
              <span aria-hidden="true" className="mt-px text-primary">
                ▸
              </span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

export default async function SettingsPage() {
  const settings = await getSettings();

  return (
    <ToastProvider>
      <div className="p-6">
        <div className="grid items-start gap-4 lg:grid-cols-2">
          <StalledSettingsCard settings={settings} />
          <ProfileCard />
          <RolesCard />
          <div className="grid gap-4">
            <DataCard />
            <RoadmapCard />
          </div>
        </div>
      </div>
    </ToastProvider>
  );
}
