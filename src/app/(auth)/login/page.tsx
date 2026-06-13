import type { Metadata } from "next";
import { LogoMark } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — JeniMcRich Recruitment",
  description: "Recruiter workspace sign-in for JeniMcRich Recruitment.",
};

const OAUTH_ERRORS: Record<string, string> = {
  oauth: "Google sign-in didn't complete. Please try again.",
  not_authorized:
    "That Google account isn't authorized for this workspace. Use your JeniMcRich account or ask an admin to add you.",
};

/** Full-screen sign-in (no app shell), backed by Supabase Auth. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const oauthError = error ? OAUTH_ERRORS[error] : null;

  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-slate-950 bg-[linear-gradient(135deg,#020617_0%,#0f172a_52%,#134e4a_100%)] px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl bg-surface p-10 shadow-overlay max-sm:p-7">
          <div className="mb-1.5 flex items-center gap-2.5">
            <LogoMark size={40} className="shrink-0" />
            <h1 className="text-[22px] font-bold leading-tight text-ink">
              JeniMcRich Recruitment
            </h1>
          </div>
          <p className="mb-6 text-[13.5px] text-slate-500">
            Recruiter Workspace — sign in to continue
          </p>
          {oauthError ? (
            <div
              role="alert"
              className="mb-4 rounded-control bg-danger-soft px-3.5 py-2.5 text-[13px] leading-snug text-danger-ink"
            >
              {oauthError}
            </div>
          ) : null}
          <LoginForm />
        </div>
        <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-400">
          Secured by Supabase Auth. Access is restricted to authorized
          JeniMcRich staff.
        </p>
      </div>
    </main>
  );
}
