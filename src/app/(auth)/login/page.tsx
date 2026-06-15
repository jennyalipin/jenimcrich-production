import type { Metadata } from "next";
import { Logo, LogoMark } from "@/components/ui";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign in — Jenny Mcrich Recruitment",
  description: "Recruiter workspace sign-in for Jenny Mcrich Recruitment.",
};

const INDUSTRIES = ["Cement", "Mining", "Aggregates", "Steel"];

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh w-full bg-canvas">
      {/* Brand panel — editorial, dark; hidden below lg */}
      <aside className="relative hidden w-[46%] shrink-0 flex-col justify-between overflow-hidden bg-sidebar px-12 py-11 xl:w-1/2 lg:flex">
        {/* tonal depth + an oversized logomark watermark (no glow/aurora) */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_80%_at_15%_0%,#13324a_0%,#0f172a_55%,#0b1220_100%)]" />
        <LogoMark
          size={520}
          variant="dark"
          className="pointer-events-none absolute -bottom-28 -right-28 opacity-[0.1]"
        />

        <Logo onDark markSize={30} className="relative" />

        <div className="relative max-w-md">
          <p className="text-[12.5px] font-semibold tracking-[0.06em] text-emerald-400 [font-variant:all-small-caps]">
            Jenny Mcrich Recruitment
          </p>
          <h1 className="mt-3 text-[34px] font-bold leading-[1.12] tracking-[-0.02em] text-white">
            The control room for heavy-industry{" "}
            <span className="text-emerald-400">hiring</span>.
          </h1>
          <p className="mt-4 text-[14.5px] leading-relaxed text-slate-300/90">
            Match, track, and move every candidate through one pipeline — from first
            résumé to signed offer, visa constraints and all.
          </p>
        </div>

        <div className="relative flex items-center gap-2 text-[12px] text-slate-400">
          {INDUSTRIES.map((industry, i) => (
            <span key={industry} className="flex items-center gap-2">
              {i > 0 ? <span className="h-1 w-1 rounded-full bg-slate-600" /> : null}
              {industry}
            </span>
          ))}
        </div>
      </aside>

      {/* Sign-in panel */}
      <section className="flex flex-1 items-center justify-center px-6 py-10">
        <div className="w-full max-w-[380px]">
          {/* Compact brand for small screens (brand panel hidden) */}
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <LogoMark size={34} variant="color" className="shrink-0" />
            <span className="text-[15px] font-bold tracking-[-0.01em] text-ink">
              Jenny Mcrich
            </span>
          </div>

          <p className="eyebrow">Sign in</p>
          <h2 className="heading-tight mt-1 text-[26px] text-ink">Welcome back</h2>
          <p className="mt-1.5 text-[13.5px] text-slate-500">
            Sign in to your recruiter workspace.
          </p>

          <div className="mt-6">
            <LoginForm />
          </div>

          <p className="mt-7 text-[12px] leading-relaxed text-slate-400">
            Protected sign-in · access is limited to authorized Jenny Mcrich staff.
          </p>
        </div>
      </section>
    </main>
  );
}
