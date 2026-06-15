"use client";

import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import starAnimation from "@/lib/lottie/star.json";
import { Icon } from "@/components/ui";
import { useMounted, useReducedMotion } from "@/lib/use-motion-prefs";

/* star.json animates an outline → filled star over frames 0–10. Recolored to
   slate-300 outline / amber-400 fill to match the priority-flag design. */
const FILLED_FRAME = 10;

/**
 * Priority-flag star that fills with a Lottie animation when toggled on and
 * empties when toggled off — motion tied to the action, never idle. The Lottie
 * lives in a fixed 20px box (so it can't overflow), and SSR/first-paint and
 * reduced-motion users get the static lucide star instead.
 *
 * Animation: useAnimations.com `star` (CC BY) — credited in Settings.
 */
export function AnimatedFlagStar({ flagged }: { flagged: boolean }) {
  const mounted = useMounted();
  const reduceMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const prevFlagged = useRef(flagged);
  const initialized = useRef(false);

  useEffect(() => {
    const lottie = lottieRef.current;
    if (!lottie) return;
    // First time the Lottie is present: snap to the resting frame, no animation.
    if (!initialized.current) {
      initialized.current = true;
      lottie.goToAndStop(flagged ? FILLED_FRAME : 0, true);
      prevFlagged.current = flagged;
      return;
    }
    if (flagged === prevFlagged.current) return;
    if (flagged) {
      lottie.setDirection(1);
      lottie.playSegments([0, FILLED_FRAME], true);
    } else {
      lottie.setDirection(-1);
      lottie.playSegments([FILLED_FRAME, 0], true);
    }
    prevFlagged.current = flagged;
  }, [flagged, mounted, reduceMotion]);

  if (!mounted || reduceMotion) {
    return <Icon name="star" size={20} fill={flagged} />;
  }

  return (
    <span className="grid size-5 place-items-center overflow-hidden" aria-hidden="true">
      <Lottie
        lottieRef={lottieRef}
        animationData={starAnimation}
        autoplay={false}
        loop={false}
        style={{ width: 20, height: 20 }}
      />
    </span>
  );
}
