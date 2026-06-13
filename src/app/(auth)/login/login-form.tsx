"use client";

import { useActionState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { signIn, type SignInState } from "./actions";

const initialState: SignInState = { error: null };

export function LoginForm() {
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
    </div>
  );
}
