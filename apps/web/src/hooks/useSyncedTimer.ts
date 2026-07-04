/**
 * useSyncedTimer Hook
 * Provides a high-precision countdown timer driven by `requestAnimationFrame`.
 * Computes an absolute end-time once and derives remaining seconds and a smooth
 * progress percentage (100 → 0) on every animation frame, avoiding drift that
 * `setInterval`-based timers are prone to.
 */

import { useState, useEffect, useRef } from 'react';

/**
 * Custom React hook that runs a frame-accurate countdown timer.
 *
 * On mount (or when `durationSeconds` changes) the hook calculates an absolute
 * end-time and uses `requestAnimationFrame` to update both a whole-second
 * `timeLeft` value (for display) and a smooth `progress` percentage (for
 * progress-bar animations). When the timer reaches zero, the optional
 * `onExpire` callback is invoked exactly once.
 *
 * @param {number} durationSeconds - Total countdown length in seconds.
 * @param {() => void} [onExpire] - Optional callback fired when the timer reaches zero.
 * @returns {{ timeLeft: number, progress: number }} An object with `timeLeft` (whole seconds remaining) and `progress` (percentage 100 → 0).
 */
export const useSyncedTimer = (durationSeconds: number, onExpire?: () => void) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [progress, setProgress] = useState(100);

  // We use refs to hold values that don't need to trigger re-renders
  const endTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Use the provided server startTime, or fallback to Date.now()
    endTimeRef.current = Date.now() + durationSeconds * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const remainingMs = Math.max(0, endTimeRef.current - now);

      // Calculate smooth percentage for the progress bar (100 down to 0)
      const newProgress = (remainingMs / (durationSeconds * 1000)) * 100;
      setProgress(newProgress);

      // Calculate clean whole seconds for text display
      setTimeLeft(Math.ceil(remainingMs / 1000));

      if (remainingMs > 0) {
        rafRef.current = requestAnimationFrame(updateTimer);
      } else {
        if (onExpire) onExpire();
      }
    };

    // Kick off the loop
    rafRef.current = requestAnimationFrame(updateTimer);

    // Cleanup loop on unmount
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [durationSeconds, onExpire]);

  return { timeLeft, progress };
};
