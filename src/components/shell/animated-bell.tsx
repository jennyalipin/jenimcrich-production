"use client";

import { useEffect, useRef } from "react";
import Lottie, { type LottieRefCurrentProps } from "lottie-react";
import bellAnimation from "@/lib/lottie/bell.json";
import { Icon } from "@/components/ui";
import { useMounted, useReducedMotion } from "@/lib/use-motion-prefs";

/* notification-v4: a clean upright bell that rings (clapper swings) over frames
   0–60. Colour is handled in globals.css (slate-300, white on hover) so it
   matches the other topbar icons on the dark bar. */
const RING_END = 60;

/**
 * Topbar bell that rings ONCE when the unread count goes up (a new alert
 * arrived), then rests — never idle. Fixed 20px box so the Lottie can't
 * overflow. SSR/first-paint and reduced-motion users get the static lucide bell.
 *
 * Animation: useAnimations.com `notification` (CC BY) — credited in Settings.
 */
export function AnimatedBell({ unread }: { unread: number }) {
  const mounted = useMounted();
  const reduceMotion = useReducedMotion();
  const lottieRef = useRef<LottieRefCurrentProps>(null);
  const prevUnread = useRef(unread);
  const initialized = useRef(false);

  const useLottie = mounted && !reduceMotion;

  useEffect(() => {
    const lottie = lottieRef.current;
    if (!lottie) return;
    if (!initialized.current) {
      initialized.current = true;
      lottie.goToAndStop(0, true);
      prevUnread.current = unread;
      return;
    }
    if (unread > prevUnread.current) {
      lottie.goToAndStop(0, true);
      lottie.playSegments([0, RING_END], true);
    }
    prevUnread.current = unread;
  }, [unread, useLottie]);

  if (!useLottie) {
    return <Icon name="bell" size={18} />;
  }

  return (
    <span className="grid size-5 place-items-center overflow-hidden" aria-hidden="true">
      <Lottie
        lottieRef={lottieRef}
        animationData={bellAnimation}
        autoplay={false}
        loop={false}
        style={{ width: 20, height: 20 }}
      />
    </span>
  );
}
