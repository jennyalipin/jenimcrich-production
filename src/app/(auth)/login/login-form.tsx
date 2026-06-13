"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Button, Icon, Input, Label } from "@/components/ui";
import { demoSignIn, signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

function DemoLoginButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="secondary" block loading={pending}>
      <Icon name="bolt" size={15} /> Demo login (Recruiter)
    </Button>
  );
}

export function LoginForm({ liveAuth = false }: { liveAuth?: boolean }) {
  const [state, formAction, isPending] = useActionState(signIn, initialState);

  return (
    <div>
      {state.error ? (
        <div
          role="alert"
          className="mb-4 rounded-control bg-danger-soft px-3.5 py-2.5 text-[13px] leading-snug text-danger-ink"
        >
          {state.error}
        </div>
      ) : null}

      <form action={formAction} className="space-y-4">
        <div>
          <Label htmlFor="login-email">Work email</Label>
          <Input
            id="login-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@jenimcrich.com"
            defaultValue={state.email ?? ""}
            invalid={Boolean(state.error)}
            autoFocus
          />
        </div>
        <div>
          <Label htmlFor="login-password">Password</Label>
          <Input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            invalid={Boolean(state.error)}
          />
        </div>
        <Button type="submit" block loading={isPending}>
          Sign in
        </Button>
      </form>

      <div
        aria-hidden="true"
        className="my-4 flex items-center gap-2.5 text-[12px] text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200"
      >
        or
      </div>

      <form action={demoSignIn}>
        <DemoLoginButton />
      </form>

      <p className="mt-4 rounded-control bg-slate-50 px-3.5 py-2.5 text-center text-[12px] leading-relaxed text-slate-500">
        {liveAuth ? (
          <>
            Use the{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-slate-700">
              <Icon name="bolt" size={13} /> Demo login
            </span>{" "}
            button to enter as the recruiter, or sign in with your own account.
          </>
        ) : (
          <>
            Demo credentials:{" "}
            <span className="font-semibold text-slate-700">jenny@jenimcrich.com</span>
            {" · "}
            <span className="font-semibold text-slate-700">demo1234</span>
          </>
        )}
      </p>
    </div>
  );
}
