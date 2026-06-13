import type { Metadata } from "next";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { LogoMark } from "@/components/ui";
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
  const liveAuth = isSupabaseConfigured();
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
          <LoginForm liveAuth={liveAuth} />
        </div>
        <p className="mt-5 text-center text-[12px] leading-relaxed text-slate-400">
          {liveAuth
            ? "Secured by Supabase Auth. All candidate data shown is fictional seed data."
            : "Demo authentication — Supabase Auth replaces this in production. All candidate data shown is fictional seed data."}
        </p>
      </div>
    </main>
  );
}
