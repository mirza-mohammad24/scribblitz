/**
 * This module provides utility functions for managing timers in the game server,
 * such as clearing timeouts and intervals. It helps ensure that timers are properly
 * handled to prevent memory leaks and unintended behavior.
 *
 */

/**
 * Clears a timeout timer if it exists and returns null. This is useful for resetting timer state in the game.
 * @param timer The timeout timer to clear
 * @returns null
 */
export const clearTimer = (timer: ReturnType<typeof setTimeout> | null): null => {
  if (timer) clearTimeout(timer);
  return null;
};

/**
 * Clears an interval timer if it exists and returns null. This is useful for resetting timer state in the game.
 * @param timer The interval timer to clear
 * @returns null
 */
export const clearIntervalTimer = (timer: ReturnType<typeof setInterval> | null): null => {
  if (timer) clearInterval(timer);
  return null;
};
