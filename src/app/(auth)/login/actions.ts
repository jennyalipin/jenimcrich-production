"use server";

/**
 * DEMO AUTH server actions — swapped for Supabase Auth once provisioned.
 * Credentials are checked in src/lib/demo-auth.ts and are never logged.
 */

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import {
  createSessionToken,
  DEMO_USER,
  SESSION_COOKIE_NAME,
  sessionCookieOptions,
  verifyDemoCredentials,
} from "@/lib/demo-auth";

export interface SignInState {
  error: string | null;
  /** Echoed back so the email field survives a failed attempt. */
  email?: string;
}

const credentialsSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }),
  password: z.string().min(1, { error: "Please enter your password." }),
});

async function establishSession(email: string): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionToken(email), sessionCookieOptions);
}

/** useActionState-compatible: (prevState, formData) → next state or redirect. */
export async function signIn(
  _prev: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const raw = {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };

  const parsed = credentialsSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues[0]?.message ??
        "Please check your email and password.",
      email: raw.email,
    };
  }

  if (!verifyDemoCredentials(parsed.data.email, parsed.data.password)) {
    return {
      error:
        "That email and password don't match. This demo workspace accepts the credentials shown below the form.",
      email: raw.email,
    };
  }

  await establishSession(parsed.data.email.trim().toLowerCase());
  redirect("/dashboard");
}

/** One-click sign-in as the demo recruiter (prototype's ⚡ Demo Login). */
export async function demoSignIn(): Promise<void> {
  await establishSession(DEMO_USER.email);
  redirect("/dashboard");
}

/** Clears the demo session cookie and returns to the login screen. */
export async function signOut(): Promise<void> {
  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 });
  redirect("/login");
}
