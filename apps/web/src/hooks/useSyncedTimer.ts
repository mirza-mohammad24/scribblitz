/**
 * Custom React hook for a synchronized countdown timer.
 *
 * The hook keeps the timer aligned to the server-provided end timestamp and
 * uses `requestAnimationFrame` plus `performance.now()` to avoid drift from
 * tab throttling or local clock changes.
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Tracks a countdown that stays in sync with a server-defined phase end time.
 *
 * The hook derives the remaining time from `localPhaseEndTime`, updates the
 * display state on each animation frame, and calls `onExpire` once when the
 * countdown reaches zero.
 *
 * @param localPhaseEndTime - Absolute end timestamp from the server, in milliseconds.
 * @param durationSeconds - Total countdown length in seconds.
 * @param onExpire - Optional callback invoked when the timer expires.
 * @returns An object containing `timeLeft` and `progress`.
 */
export const useSyncedTimer = (
  localPhaseEndTime: number | null,
  durationSeconds: number,
  onExpire?: () => void,
) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [progress, setProgress] = useState(100);

  // Store the animation frame id without triggering re-renders.
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Do not start ticking until the server provides an anchor.
    if (!localPhaseEndTime) return;

    // Capture the remaining time at the moment this effect starts.
    const initialRemainingMs = Math.max(0, localPhaseEndTime - Date.now());

    // Lock in a monotonic timestamp so local clock changes do not affect the countdown.
    const startTimeMono = performance.now();

    const updateTimer = () => {
      // Calculate elapsed time using the monotonic clock only.
      const elapsedMono = performance.now() - startTimeMono;
      const currentRemainingMs = Math.max(0, initialRemainingMs - elapsedMono);

      // Update the display state.
      const newProgress =
        durationSeconds > 0 ? (currentRemainingMs / (durationSeconds * 1000)) * 100 : 0;
      setProgress(newProgress);
      setTimeLeft(Math.ceil(currentRemainingMs / 1000));

      // Continue until the timer expires.
      if (currentRemainingMs > 0) {
        rafRef.current = requestAnimationFrame(updateTimer);
      } else {
        if (onExpire) onExpire();
      }
    };

    rafRef.current = requestAnimationFrame(updateTimer);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [localPhaseEndTime, durationSeconds, onExpire]);

  return { timeLeft, progress };
};
