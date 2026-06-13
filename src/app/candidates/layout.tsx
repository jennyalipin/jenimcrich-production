import type { ReactNode } from "react";
import { ToastProvider } from "@/components/ui";

/**
 * Candidates section layout. Mounts the ToastProvider for every /candidates
 * route so mutation feedback (add candidate, notes, scorecards, bookings…)
 * can use `useToast()`. If a global provider is later mounted in the app
 * shell, this nested one keeps working — `useToast` resolves the nearest.
 */
export default function CandidatesLayout({ children }: { children: ReactNode }) {
  return <ToastProvider>{children}</ToastProvider>;
}
