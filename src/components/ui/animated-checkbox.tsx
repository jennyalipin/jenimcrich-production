"use client";

import { useEffect, useRef, type ReactNode } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import checkboxAnimation from "@/lib/lottie/checkbox.json";
import { useMounted, useReducedMotion } from "@/lib/use-motion-prefs";
import { cn } from "./cn";

/* checkbox.json draws the checkmark in over frames 0–30. Recolored to a
   slate-300 box + emerald-600 tick to match the app's native checkboxes. */
const CHECKED_FRAME = 30;

const NATIVE_BOX =
  "h-3.5 w-3.5 shrink-0 rounded border-slate-300 accent-emerald-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600";

interface AnimatedCheckboxProps {
  checked: boolean;
  onChange: () => void;
  /** Label content shown after the box. */
  children?: ReactNode;
  className?: string;
}

/**
 * Accessible checkbox whose tick draws in (and out) on toggle. A real, focusable
 * native input drives state and keyboard support; the Lottie is purely visual.
 * SSR/first-paint and reduced-motion users get the plain native checkbox.
 * Animation only plays on the toggle — never idle.
 *
 * Animation: useAnimations.com `checkBox` (CC BY) — credited in Settings.
 */
export function AnimatedCheckbox({ checked, onChange, children, className }: AnimatedCheckboxProps) {
  const mounted = useMounted();
  const reduceMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const prevChecked = useRef(checked);
  const initialized = useRef(false);

  const useLottie = mounted && !reduceMotion;

  useEffect(() => {
    const lottie = lottieRef.current;
    if (!lottie) return;
    if (!initialized.current) {
      initialized.current = true;
      lottie.goToAndStop(checked ? CHECKED_FRAME : 0, true);
      prevChecked.current = checked;
      return;
    }
    if (checked === prevChecked.current) return;
    if (checked) {
      lottie.setDirection(1);
      lottie.playSegments([0, CHECKED_FRAME], true);
    } else {
      lottie.setDirection(-1);
      lottie.playSegments([CHECKED_FRAME, 0], true);
    }
    prevChecked.current = checked;
  }, [checked, useLottie]);

  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-[13px] text-slate-600", className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className={useLottie ? "sr-only" : NATIVE_BOX}
      />
      {useLottie ? (
        <span className="grid size-4 shrink-0 place-items-center overflow-hidden" aria-hidden="true">
          <Lottie
            lottieRef={lottieRef}
            animationData={checkboxAnimation}
            autoplay={false}
            loop={false}
            style={{ width: 18, height: 18 }}
          />
        </span>
      ) : null}
      {children}
    </label>
  );
}
