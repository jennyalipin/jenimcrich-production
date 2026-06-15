import type { Metadata } from "next";
import { signOut } from "@/app/(auth)/login/actions";
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
  ToastProvider,
} from "@/components/ui";
import { getSettings } from "@/lib/data";
import { DEMO_USER } from "@/lib/demo-auth";
import { initials } from "@/lib/format";
import { StalledSettingsCard } from "./stalled-settings-card";
import { SampleDataCard } from "./sample-data-card";

export const metadata: Metadata = {
  title: "Settings — Jenny Mcrich Recruitment",
};

function ProfileCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
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
              <Badge variant="success">Administrator</Badge>
            </div>
            <div className="truncate text-[12.5px] text-slate-500">{DEMO_USER.email}</div>
          </div>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="sm">
            Sign out
          </Button>
        </form>
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
          <SampleDataCard />
        </div>
        <p className="mt-6 text-[11.5px] text-slate-400">
          Icon animations by{" "}
          <a
            href="https://useanimations.com"
            target="_blank"
            rel="noreferrer"
            className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600"
          >
            useAnimations
          </a>{" "}
          (CC BY 4.0).
        </p>
      </div>
    </ToastProvider>
  );
}
