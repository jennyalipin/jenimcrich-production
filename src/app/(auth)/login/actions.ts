"use server";

/**
 * Sign-in server actions.
 *
 * When Supabase is configured these drive Supabase Auth (cookies set via the
 * @supabase/ssr server client); otherwise they fall back to the signed-cookie
 * demo session in `@/lib/demo-auth`, so the app still runs with zero config.
 * Credentials are never logged.
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
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export interface SignInState {
  error: string | null;
  /** Echoed back so the email field survives a failed attempt. */
  email?: string;
}

const credentialsSchema = z.object({
  email: z.email({ error: "Please enter a valid email address." }),
  password: z.string().min(1, { error: "Please enter your password." }),
});

async function establishDemoSession(email: string): Promise<void> {
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

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email.trim(),
      password: parsed.data.password,
    });
    if (error) {
      return {
        error: "That email and password don't match. Please try again.",
        email: raw.email,
      };
    }
    redirect("/dashboard");
  }

  if (!verifyDemoCredentials(parsed.data.email, parsed.data.password)) {
    return {
      error:
        "That email and password don't match. This demo workspace accepts the credentials shown below the form.",
      email: raw.email,
    };
  }

  await establishDemoSession(parsed.data.email.trim().toLowerCase());
  redirect("/dashboard");
}

/** One-click sign-in as the recruiter/owner (prototype's ⚡ Demo Login). */
export async function demoSignIn(): Promise<void> {
  const supabase = await getSupabaseServerClient();
  if (supabase) {
    const password = process.env.STAGING_USER_PASSWORD;
    if (password) {
      const { error } = await supabase.auth.signInWithPassword({
        email: DEMO_USER.email,
        password,
      });
      if (!error) redirect("/dashboard");
    }
    // No staging password configured — send the user to sign in explicitly.
    redirect("/login");
  }

  await establishDemoSession(DEMO_USER.email);
  redirect("/dashboard");
}

/** Signs out of either backend and returns to the login screen. */
export async function signOut(): Promise<void> {
  if (isSupabaseConfigured()) {
    const supabase = await getSupabaseServerClient();
    await supabase?.auth.signOut();
  } else {
    const store = await cookies();
    store.set(SESSION_COOKIE_NAME, "", { ...sessionCookieOptions, maxAge: 0 });
  }
  redirect("/login");
}
