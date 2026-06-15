"use client";

import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import trashAnimation from "@/lib/lottie/trash.json";
import { useMounted, useReducedMotion } from "@/lib/use-motion-prefs";
import { Icon } from "./icon";

/* trash.json lifts the lid over frames 0–5. Recolored white for danger buttons. */
const LID_END = 5;

/**
 * Trash icon whose lid lifts while `playing` is true (drive it from the parent
 * button's hover). Resets when not playing; never idle. SSR/first-paint and
 * reduced-motion users get the static lucide trash.
 *
 * Animation: useAnimations.com `trash` (CC BY) — credited in Settings.
 */
export function AnimatedTrash({ playing, size = 14 }: { playing: boolean; size?: number }) {
  const mounted = useMounted();
  const reduceMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const useLottie = mounted && !reduceMotion;

  useEffect(() => {
    const lottie = lottieRef.current;
    if (!lottie) return;
    if (playing) {
      lottie.setDirection(1);
      lottie.playSegments([0, LID_END], true);
    } else {
      lottie.goToAndStop(0, true);
    }
  }, [playing, useLottie]);

  if (!useLottie) return <Icon name="trash" size={size} />;

  return (
    <span
      className="grid shrink-0 place-items-center overflow-hidden"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <Lottie
        lottieRef={lottieRef}
        animationData={trashAnimation}
        autoplay={false}
        loop={false}
        style={{ width: size + 4, height: size + 4 }}
      />
    </span>
  );
}
