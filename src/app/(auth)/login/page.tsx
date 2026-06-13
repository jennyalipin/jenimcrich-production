import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — JeniMcRich Recruitment",
  description: "Recruiter workspace sign-in for JeniMcRich Recruitment.",
};

/**
 * Full-screen sign-in (no app shell). Demo auth only — replaced by
 * Supabase Auth once the project is provisioned.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-dvh w-full items-center justify-center bg-slate-950 bg-[linear-gradient(135deg,#020617_0%,#0f172a_52%,#134e4a_100%)] px-4 py-10">
      <div className="w-full max-w-[400px]">
        <div className="rounded-2xl bg-surface p-10 shadow-overlay max-sm:p-7">
          <div className="mb-1.5 flex items-center gap-2.5">
            <div
              aria-hidden="true"
              className="grid size-10 shrink-0 place-items-center rounded-[10px] bg-[linear-gradient(135deg,#10b981,#0d9488)] text-lg font-extrabold text-white"
            >
              JM
            </div>
            <h1 className="text-[22px] font-bold leading-tight text-ink">
              JeniMcRich Recruitment
            </h1>
          </div>
          <p className="mb-6 text-[13.5px] text-slate-500">
            Recruiter Workspace — sign in to continue
          </p>
          <LoginForm />
        </div>
        <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-400">
          Demo authentication — Supabase Auth replaces this in production.
          <br />
          All candidate data shown is fictional seed data.
        </p>
      </div>
    </main>
  );
}
