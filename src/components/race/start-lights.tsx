'use client';

import { useEffect, useState } from 'react';

const LIGHTS = 5;
const STEP_MS = 280;
const TOTAL_MS = LIGHTS * STEP_MS + 900;

/** Races younger than this get the start sequence; older ones (replays, reloads) don't. */
const FRESH_MS = 15_000;

/**
 * F1-style start sequence shown over a race that has only just begun. Purely cosmetic:
 * the agents are already running underneath, and their events keep streaming in.
 * Decided after mount so server and client render the same markup.
 */
export function StartLights({ createdAt }: { createdAt: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (Date.now() - Date.parse(createdAt) > FRESH_MS) return;
    const show = setTimeout(() => setVisible(true), 0);
    const hide = setTimeout(() => setVisible(false), TOTAL_MS);
    return () => {
      clearTimeout(show);
      clearTimeout(hide);
    };
  }, [createdAt]);

  if (!visible) return null;

  return (
    <div
      role="status"
      aria-label="Race starting"
      className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-8 bg-bg/85 backdrop-blur-sm"
      style={{ animation: `overlay-out 250ms ease-in ${TOTAL_MS - 250}ms forwards` }}
    >
      <div className="flex gap-3 rounded-2xl bg-fg p-4 shadow-2xl sm:gap-4 sm:p-5">
        {Array.from({ length: LIGHTS }, (_, i) => (
          <span
            key={i}
            className="h-10 w-10 rounded-full bg-surface-2 sm:h-12 sm:w-12"
            style={{
              animation: `light-on 120ms ease-out ${i * STEP_MS}ms forwards, lights-out 80ms linear ${LIGHTS * STEP_MS + 200}ms forwards`,
            }}
          />
        ))}
      </div>
      <span
        className="font-display text-6xl font-extrabold italic tracking-tight opacity-0"
        style={{ animation: `go-pop 400ms cubic-bezier(0.2,0.8,0.2,1) ${LIGHTS * STEP_MS + 220}ms forwards` }}
      >
        GO
      </span>
    </div>
  );
}
