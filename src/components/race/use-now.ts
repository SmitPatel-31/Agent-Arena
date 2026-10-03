'use client';

import { useEffect, useState } from 'react';

/** Current time, re-rendering every `intervalMs` while `active`. */
export function useNow(active: boolean, intervalMs = 100): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [active, intervalMs]);
  return now;
}

/** Animates from 0 to `target` once (ease-out), for scorecard numbers. */
export function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    // Reduced motion: jump straight to the value on the first frame.
    const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : durationMs;
    let frame = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = duration === 0 ? 1 : Math.min(1, (t - start) / duration);
      setValue(target * (1 - (1 - p) ** 3));
      if (p < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, durationMs]);
  return value;
}
