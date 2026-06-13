"use client";

import { useActionState, useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

function GoogleMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.72A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.72V4.95H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.05l3.01-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.59C13.47.9 11.43 0 9 0A9 9 0 0 0 .96 4.95L3.97 7.28C4.68 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(signIn, initialState);
  const [googleLoading, setGoogleLoading] = useState(false);

  async function signInWithGoogle() {
    const supabase = getSupabaseBrowserClient();
    if (!supabase) return;
    setGoogleLoading(true);
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    // On success the browser navigates to Google; only reset on error.
    if (error) setGoogleLoading(false);
  }

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

      <Button
        type="button"
        variant="ghost"
        block
        loading={googleLoading}
        onClick={signInWithGoogle}
      >
        {googleLoading ? null : <GoogleMark />}
        Continue with Google
      </Button>

      <div
        aria-hidden="true"
        className="my-4 flex items-center gap-2.5 text-[12px] text-slate-400 before:h-px before:flex-1 before:bg-slate-200 after:h-px after:flex-1 after:bg-slate-200"
      >
        or
      </div>

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
    </div>
  );
}
