import { useState, useEffect, useRef } from 'react';

export const useSyncedTimer = (durationSeconds: number, onExpire?: () => void) => {
  const [timeLeft, setTimeLeft] = useState(durationSeconds);
  const [progress, setProgress] = useState(100);

  // We use refs to hold values that don't need to trigger re-renders
  const endTimeRef = useRef<number>(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    // Set the absolute moment in the future this timer should end
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
